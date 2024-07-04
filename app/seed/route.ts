import bcrypt from 'bcrypt';
import {invoices, customers, users, revenue as revenueData} from '../lib/placeholder-data';
import {prisma} from "@/prisma/client";


async function seedUsers() {
  for (const user of users) {
    await prisma.user.create({
      data: {...user, password: await bcrypt.hash(user.password, 10)},
    });
  }
}

async function seedInvoices() {
  for (const invoice of invoices) {
    await prisma.invoice.create({
      data: {
        amount: invoice.amount,
        status: invoice.status,
        date: new Date(invoice.date),
        customer: {
          connect: {
            id: invoice.customer_id,
          },
        },
      },
    });
  }
}

async function seedCustomers() {
  for (const customer of customers) {
    await prisma.customer.create({
      data: {name: customer.name, email: customer.email, imageUrl: customer.image_url, id: customer.id},
    });
  }
}

async function seedRevenue() {
  for (const revenue of revenueData) {
    // 使用 Prisma 客户端的 create 方法插入数据
    await prisma.revenue.create({
      data: {
        month: revenue.month,
        revenue: revenue.revenue,
      },
    });
  }
}

export async function GET() {
  try {
    // await seedUsers();
    // await seedCustomers();
    for (let i = 0; i < 1000; i++) {
      await seedInvoices();
    }
    // await seedRevenue();
    const data = await prisma.customer.findMany({
      include: {
        invoices: true,
      },
    })

    const invoices = await prisma.invoice.findMany({
      where: {
        amount: 666,
      },
      include: {
        customer: true,
      },
    });

    return Response.json({ message: 'Database seeded successfully', data, invoices });
  } catch (error) {
    return Response.json({ error }, { status: 500 });
  }
}
