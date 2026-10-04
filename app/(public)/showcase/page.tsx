import type { Metadata } from "next"
import { auth } from "@/lib/auth"
import { getProjects } from "@/lib/actions/projects"
import { ShowcaseClient } from "./showcase-client"

export const metadata: Metadata = {
    title: "Project Showcase",
    description: "Projects built by Technova students at Sharda University.",
}

export default async function ShowcasePage() {
    const [projects, session] = await Promise.all([getProjects(), auth()])
    return <ShowcaseClient projects={projects} currentUserId={session?.user?.id} />
}
