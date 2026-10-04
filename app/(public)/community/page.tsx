import type { Metadata } from "next"
import { auth } from "@/lib/auth"
import { getPosts } from "@/lib/actions/community"
import { CommunityClient } from "./community-client"

export const metadata: Metadata = {
    title: "Community",
    description: "Ask questions, share projects and find hackathon teammates in the Technova community.",
}

export default async function CommunityPage() {
    const [posts, session] = await Promise.all([getPosts(), auth()])
    return <CommunityClient posts={posts} session={session?.user?.id ? { user: { id: session.user.id } } : null} />
}
