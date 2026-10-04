'use server'

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/lib/auth";

const createResourceSchema = z.object({
    title: z.string().min(3, "Title must be at least 3 characters"),
    description: z.string().optional(),
    file_url: z.string().url("Must be a valid URL"),
    type: z.string(),
    semester: z.string().optional(),
    subject: z.string().optional(),
});

export async function createResource(prevState: any, formData: FormData) {
    const supabase = await createClient();
    const session = await auth();
    const user = session?.user;

    if (!user || !user.id) {
        return { error: "You must be logged in to upload resources." };
    }

    // Role from the session (managed on the Roles page), not the old hard-coded email list.
    const isAdmin = user.role === 'admin' || user.role === 'super_admin';

    const result = createResourceSchema.safeParse({
        title: formData.get("title"),
        description: formData.get("description"),
        file_url: formData.get("file_url"),
        type: formData.get("type"),
        semester: formData.get("semester"),
        subject: formData.get("subject"),
    });

    if (!result.success) {
        return { error: result.error.issues[0]?.message || "Validation failed" };
    }

    const { title, description, file_url, type, semester, subject } = result.data;

    // Use admin client
    const supabaseAdmin = createAdminClient();
    const { error } = await supabaseAdmin.from('resources').insert({
        uploaded_by: user.id,
        title,
        description,
        file_url,
        type,
        semester,
        subject,
        is_verified: isAdmin ? true : false
    });

    if (error) {
        console.error("Error creating resource:", error);
        return { error: "Failed to upload resource" };
    }

    revalidatePath('/resources');
    revalidateTag('resources', { expire: 0 });
    revalidatePath('/admin/resources');
    return { success: true };
}

export async function getResources(semester?: string, subject?: string) {
    const supabase = await createClient();
    let query = supabase
        .from('resources')
        .select('*')
        .eq('is_verified', true) // Only show verified
        .order('created_at', { ascending: false });

    if (semester && semester !== 'all') {
        query = query.eq('semester', semester);
    }

    if (subject) {
        query = query.ilike('subject', `%${subject}%`);
    }

    const { data, error } = await query;

    if (error) {
        console.error("Error fetching resources:", error);
        return [];
    }

    return data;
}

export async function getAllResourcesAdmin() {
    const session = await auth();
    if (!session || !session.user || !['admin', 'super_admin'].includes(session.user.role)) {
        throw new Error("Unauthorized");
    }

    const supabase = createAdminClient();

    // 1. Get resources
    const { data: resources, error } = await supabase
        .from('resources')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    if (!resources || resources.length === 0) return [];

    // 2. Get User IDs
    const userIds = Array.from(new Set(resources.map(r => r.uploaded_by)));

    // 3. Get User Details
    const { data: users, error: userError } = await supabase
        .schema('next_auth')
        .from('users')
        .select('id, name, email')
        .in('id', userIds);

    // 4. Merge
    const combined = resources.map(res => {
        const user = users?.find(u => u.id === res.uploaded_by);
        return {
            ...res,
            user: user || { name: 'Unknown', email: 'Unknown' }
        };
    });

    return combined;
}

export async function approveResource(id: string) {
    const session = await auth();
    if (!session || !session.user || !['admin', 'super_admin'].includes(session.user.role)) {
        throw new Error("Unauthorized");
    }

    const supabase = createAdminClient();
    const { error } = await supabase
        .from('resources')
        .update({ is_verified: true })
        .eq('id', id);

    if (error) throw new Error(error.message);

    revalidatePath('/resources');
    revalidateTag('resources', { expire: 0 });
    revalidatePath('/admin/resources');
}

export async function deleteResource(id: string) {
    const session = await auth();
    if (!session || !session.user || !['admin', 'super_admin'].includes(session.user.role)) {
        throw new Error("Unauthorized");
    }

    const supabase = createAdminClient();
    const { error } = await supabase
        .from('resources')
        .delete()
        .eq('id', id);

    if (error) throw new Error(error.message);

    revalidatePath('/resources');
    revalidateTag('resources', { expire: 0 });
    revalidatePath('/admin/resources');
}
