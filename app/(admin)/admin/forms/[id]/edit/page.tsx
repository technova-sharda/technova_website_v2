import { getFormById } from "@/lib/actions/forms"
import { createAdminClient } from "@/lib/supabase/server"
import { fetchAllRows } from "@/lib/supabase/fetch-all"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { FormEditorTabs } from "./form-editor-tabs"

export default async function EditFormPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const form = await getFormById(id)

    if (!form) {
        notFound()
    }

    const mappedFields = form.fields.map((f: any) => ({
        id: f.id,
        type: f.type,
        label: f.label,
        description: f.description || undefined,
        required: f.required,
        options: f.options,
        allowOther: f.validation?.allowOther || false,
        minLength: f.validation?.minLength,
        maxLength: f.validation?.maxLength,
        minValue: f.validation?.minValue,
        maxValue: f.validation?.maxValue,
        optionRouting: f.validation?.optionRouting,
        validation: f.validation || {},
    }))

    // Answers per question, so deleting a question that has answers asks first
    const fieldIds = form.fields.map((f: any) => f.id as string)
    const sb = createAdminClient()
    const { data: answerRows } = fieldIds.length
        ? await fetchAllRows<{ field_id: string }>((from, to) => sb.from("form_response_answers").select("id, field_id").in("field_id", fieldIds).order("id").range(from, to))
        : { data: [] as { field_id: string }[] }
    const answerCounts: Record<string, number> = {}
    for (const r of answerRows) answerCounts[r.field_id] = (answerCounts[r.field_id] ?? 0) + 1

    return (
        <div className="pb-12 max-w-6xl mx-auto">
            <div className="flex items-center gap-4 mb-6">
                <Link
                    href="/admin/forms"
                    className="p-3 bg-[#1e1e22] hover:bg-[#27272a] text-white rounded-xl transition-all border border-[#27272a]"
                >
                    <ArrowLeft className="w-5 h-5" />
                </Link>
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                        {form.title}
                    </h1>
                    <p className="text-[#71717a] text-sm mt-1">Build the sections and questions, and choose what comes next.</p>
                </div>
            </div>

            <FormEditorTabs form={form} initialFields={mappedFields} formId={id} answerCounts={answerCounts} />
        </div>
    )
}
