'use server';


import { z } from 'zod';
import {prisma} from "@/prisma/client";
import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";

const FormSchema = z.object({
    id: z.string(),
    customerId: z.string(),
    amount: z.coerce.number(),
    status: z.enum(['pending', 'paid']),
    date: z.string(),
});

const CreateInvoice = FormSchema.omit({ id: true, date: true });
export async function createInvoice(formData: FormData) {
    const { customerId, amount, status } = CreateInvoice.parse({
        customerId: formData.get('customerId'),
        amount: formData.get('amount'),
        status: formData.get('status'),
    });
    const amountInCents = amount * 100;
    const date = new Date();

    const newInvoice = await prisma.invoice.create({
        data: {
            customer: {
                connect: {
                    id: customerId, // 使用找到的 Customer 的 ID
                },
            },
            amount: amountInCents,
            status: status,
            date: date,
        },
    });
    revalidatePath('/dashboard/invoices');
    redirect('/dashboard/invoices');
}

// Use Zod to update the expected types
const UpdateInvoice = FormSchema.omit({ id: true, date: true });

// ...

export async function updateInvoice(id: string, formData: FormData) {
    const { customerId, amount, status } = UpdateInvoice.parse({
        customerId: formData.get('customerId'),
        amount: formData.get('amount'),
        status: formData.get('status'),
    });

    const amountInCents = amount * 100;

    const updatedInvoice = await prisma.invoice.update({
        where: {
            id: id, // 指定要更新的 Invoice 记录的 ID
        },
        data: {
            customer: {
                connect: {
                    id: customerId, // 使用找到的 Customer 的 ID
                },
            },
            amount: amountInCents, // 更新金额
            status: status, // 更新状态
            date: new Date(), // 更新日期
        },
    });


    revalidatePath('/dashboard/invoices');
    redirect('/dashboard/invoices');
}

export async function deleteInvoice(id: string) {
    const deletedInvoice = await prisma.invoice.delete({
        where: {
            id: id, // 指定要删除的 Invoice 记录的 ID
        },
    });
    console.log('Invoice deleted:', deletedInvoice);
    revalidatePath('/dashboard/invoices');
}