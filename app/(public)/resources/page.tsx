import type { Metadata } from "next"
import { getCachedResources } from "@/lib/data/public-cache"
import { ResourcesClient } from "./resources-client"

export const metadata: Metadata = {
    title: "Academic Resources",
    description: "PYQs, notes and study material for Sharda University B.Tech, shared by seniors and peers.",
}

type Props = { searchParams: Promise<{ semester?: string | string[]; subject?: string | string[] }> }

export default async function ResourcesPage({ searchParams }: Props) {
    const params = await searchParams
    const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? ""
    const semester = first(params.semester) || "all"
    const subject = first(params.subject).trim().slice(0, 100)
    const resources = await getCachedResources(semester, subject)
    return <ResourcesClient resources={resources} semesterParam={semester} subject={subject} />
}
