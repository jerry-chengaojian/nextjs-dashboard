'use server';


import { z } from 'zod';
import {prisma} from "@/prisma/client";
import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import { signIn } from '@/auth';
import { AuthError } from 'next-auth';

// ...
export async function authenticate(
    prevState: string | undefined,
    formData: FormData,
) {
    try {
        await signIn('credentials', formData);
    } catch (error) {
        if (error instanceof AuthError) {
            switch (error.type) {
                case 'CredentialsSignin':
                    return 'Invalid credentials.';
                default:
                    return 'Something went wrong.';
            }
        }
        throw error;
    }
}

const FormSchema = z.object({
    id: z.string(),
    customerId: z.string({
        invalid_type_error: 'Please select a customer.',
    }),
    amount: z.coerce
        .number()
        .gt(0, { message: 'Please enter an amount greater than $0.' }),
    status: z.enum(['pending', 'paid'], {
        invalid_type_error: 'Please select an invoice status.',
    }),
    date: z.string(),
});

const CreateInvoice = FormSchema.omit({ id: true, date: true });
export type State = {
    errors?: {
        customerId?: string[];
        amount?: string[];
        status?: string[];
    };
    message?: string | null;
};

export async function createInvoice(prevState: State, formData: FormData) {
    const validatedFields = CreateInvoice.safeParse({
        customerId: formData.get('customerId'),
        amount: formData.get('amount'),
        status: formData.get('status'),
    });
    if (!validatedFields.success) {
        return {
            errors: validatedFields.error.flatten().fieldErrors,
            message: 'Missing Fields. Failed to Create Invoice.',
        };
    }
    // Prepare data for insertion into the database
    const { customerId, amount, status } = validatedFields.data;
    const amountInCents = amount * 100;
    const date = new Date();
    try {
        await prisma.$transaction(async (prisma) => {
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
        });
    } catch (error) {
        // 如果在事务中抛出异常，事务会自动回滚
        console.error("Transaction failed:", error);
        return {
            message: 'Database Error: Failed to Create Invoice.',
        };
    }
    revalidatePath('/dashboard/invoices');
    redirect('/dashboard/invoices');
}

// Use Zod to update the expected types
const UpdateInvoice = FormSchema.omit({ id: true, date: true });

// ...

export async function updateInvoice(id: string,
                                    prevState: State,
                                    formData: FormData,) {
    const validatedFields = UpdateInvoice.safeParse({
        customerId: formData.get('customerId'),
        amount: formData.get('amount'),
        status: formData.get('status'),
    });

    if (!validatedFields.success) {
        return {
            errors: validatedFields.error.flatten().fieldErrors,
            message: 'Missing Fields. Failed to Update Invoice.',
        };
    }

    const { customerId, amount, status } = validatedFields.data;

    const amountInCents = amount * 100;

    try {
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
    } catch (e) {
        return { message: 'Database Error: Failed to Update Invoice.' };
    }


    revalidatePath('/dashboard/invoices');
    redirect('/dashboard/invoices');
}

export async function deleteInvoice(id: string) {
    try {
        const deletedInvoice = await prisma.invoice.delete({
            where: {
                id: id, // 指定要删除的 Invoice 记录的 ID
            },
        });
        console.log('Invoice deleted:', deletedInvoice);
    } catch (e) {
        return { message: 'Database Error: Failed to Delete Invoice.' };
    }
    revalidatePath('/dashboard/invoices');
}