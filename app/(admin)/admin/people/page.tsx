import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { PeopleSearch } from "./people-search"

export const metadata = { title: "People" }

export default async function PeoplePage() {
    const session = await auth()
    if (session?.user?.role !== "super_admin") redirect("/admin/dashboard")
    return <PeopleSearch />
}
