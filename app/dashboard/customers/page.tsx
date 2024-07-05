import {auth} from "@/auth";
import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Customers | Acme Dashboard',
};
export default async function Page() {
    const session = await auth()
    return <p>Customers Page {session?.user?.name} {session?.user?.email}</p>;
}