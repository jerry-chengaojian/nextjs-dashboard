import {auth} from "@/auth";

export default async function Page() {
    const session = await auth()
    return <p>Customers Page {session?.user?.name} {session?.user?.email}</p>;
}