import { sql } from '@vercel/postgres';
import {
  CustomerField,
  CustomersTableType,
  InvoiceForm,
  InvoicesTable,
  LatestInvoiceRaw,
  Revenue,
} from './definitions';
import { formatCurrency } from './utils';
import {prisma} from "@/prisma/client";

export async function fetchRevenue() {
  try {
    console.log('Fetching revenue data...');
    await new Promise((resolve) => setTimeout(resolve, 3000));
    const revenue = await prisma.revenue.findMany();
    console.log('Data fetch completed after 3 seconds.');
    return revenue
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch revenue data.');
  }
}

export async function fetchLatestInvoices() {
  try {
    console.log('Fetching revenue data...');
    await new Promise((resolve) => setTimeout(resolve, 1000));
    console.log('Data fetch completed after 3 seconds.');
    const latestInvoices = await prisma.invoice.findMany({
      include: {
        customer: true, // 包含关联的客户信息
      },
      orderBy: {
        date: 'desc', // 按日期降序排序
      },
      take: 5, // 只取最新的5条记录
    });
    const formattedInvoices = latestInvoices.map((invoice) => ({
      ...invoice,
      amount: formatCurrency(invoice.amount),
      image_url: invoice.customer.imageUrl,
      name: invoice.customer.name,
      email: invoice.customer.email
    }));
    return formattedInvoices;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch the latest invoices.');
  }
}

export async function fetchCardData() {
  try {
    // 使用 Prisma 查询发票和客户的数量
    const invoiceCount = await prisma.invoice.count();
    const customerCount = await prisma.customer.count();

    // 使用 Prisma 查询发票的支付和待处理状态
    // const invoiceStatusTotals = await prisma.invoice.aggregate({
    //   _sum: {
    //     amount: true,
    //   },
    //   _group: {
    //     by: 'status',
    //   },
    // });
    // console.log(invoiceStatusTotals)

    const invoiceStatusTotals = await prisma.invoice.groupBy({
      by: ['status'],
      _sum: {
        amount: true,
      },
    })


    let totalPaidInvoices = '0'; // 初始化为0
    let totalPendingInvoices = '0'; // 初始化为0

// 遍历数组，根据status为'paid'的记录累加amount
    invoiceStatusTotals.forEach(item => {
      const amount = item._sum.amount as number
      if (item.status === 'paid') {
        totalPaidInvoices = formatCurrency(amount);
      } else {
        totalPendingInvoices = formatCurrency(amount);
      }
    });

    let invoiceStatus = {}
    // 格式化金额并返回结果

    return {
      numberOfCustomers: customerCount,
      numberOfInvoices: invoiceCount,
      totalPaidInvoices,
      totalPendingInvoices,
    };
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch card data.');
  }
}

const ITEMS_PER_PAGE = 6;
export async function fetchFilteredInvoices(
  query: string,
  currentPage: number,
) {
  await new Promise((resolve) => setTimeout(resolve, 200));
  const offset = (currentPage - 1) * ITEMS_PER_PAGE;

  try {
    const invoices = await prisma.invoice.findMany({
      where: {
        OR: [
          // { amount: { contains: query } },
          // { date: { contains: query } },
          { status: { contains: query } },
          {
            customer: {
              OR: [
                { name: { contains: query } },
                { email: { contains: query } },
              ],
            },
          },
        ],
      },
      include: {
        customer: true,
      },
      orderBy: {
        date: 'desc',
      },
      take: ITEMS_PER_PAGE,
      skip: offset,
    });
    return invoices;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch invoices.');
  }
}

export async function fetchInvoicesPages(query: string) {
  try {
    const count = await prisma.invoice.count({
      where: {
        OR: [
          // { amount: { contains: query } },
          // { date: { contains: query } },
          { status: { contains: query } },
          {
            customer: {
              OR: [
                { name: { contains: query } },
                { email: { contains: query } },
              ],
            },
          },
        ],
      }
    });

    const totalPages = Math.ceil(Number(count) / ITEMS_PER_PAGE);
    return totalPages;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch total number of invoices.');
  }
}

export async function fetchInvoiceById(id: string) {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: {
        id: id,
      },
      // 使用 include 选项来包含关联的 Customer 数据
      include: {
        customer: true,
      },
    });
    if (!invoice) return null
    // id: string;
    // customer_id: string;
    // amount: number;
    // status: 'pending' | 'paid';
    return {id: invoice!.id, amount: invoice!.amount / 100, status: (invoice!.status as 'pending' | 'paid'), customer_id: invoice!.customer.id} as {id: string; customer_id: string; amount: number; status: 'pending' | 'paid'};
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch invoice.');
  }
}

export async function fetchCustomers() {
  try {
    const customers = await prisma.customer.findMany({
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        name: 'asc',
      },
    });
    return customers;
  } catch (err) {
    console.error('Database Error:', err);
    throw new Error('Failed to fetch all customers.');
  }
}

export async function fetchFilteredCustomers(query: string) {
  try {
    const data = await sql<CustomersTableType>`
		SELECT
		  customers.id,
		  customers.name,
		  customers.email,
		  customers.image_url,
		  COUNT(invoices.id) AS total_invoices,
		  SUM(CASE WHEN invoices.status = 'pending' THEN invoices.amount ELSE 0 END) AS total_pending,
		  SUM(CASE WHEN invoices.status = 'paid' THEN invoices.amount ELSE 0 END) AS total_paid
		FROM customers
		LEFT JOIN invoices ON customers.id = invoices.customer_id
		WHERE
		  customers.name ILIKE ${`%${query}%`} OR
        customers.email ILIKE ${`%${query}%`}
		GROUP BY customers.id, customers.name, customers.email, customers.image_url
		ORDER BY customers.name ASC
	  `;

    const customers = data.rows.map((customer) => ({
      ...customer,
      total_pending: formatCurrency(customer.total_pending),
      total_paid: formatCurrency(customer.total_paid),
    }));

    return customers;
  } catch (err) {
    console.error('Database Error:', err);
    throw new Error('Failed to fetch customer table.');
  }
}
