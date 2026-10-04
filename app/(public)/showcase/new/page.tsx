import { auth } from "@/lib/auth";
import { SubmitProjectForm } from "@/components/projects/SubmitProject";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function NewProjectPage() {
    const session = await auth();

    if (!session) {
        return (
            <div className="container py-20 flex flex-col items-center justify-center text-center">
                <h1 className="text-3xl font-bold mb-4">Login Required</h1>
                <p className="text-muted-foreground mb-8 text-lg">
                    You must be logged in to submit a project to the showcase.
                </p>
                <Link href="/login">
                    <Button size="lg">Login to Continue</Button>
                </Link>
            </div>
        );
    }

    return (
        <div className="container py-8">
            <div className="mb-8 text-center">
                <h1 className="text-3xl font-bold mb-2">Submit Your Project</h1>
                <p className="text-muted-foreground">
                    Share what you&apos;ve built with the community.
                </p>
            </div>
            <SubmitProjectForm />
        </div>
    );
}
