"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { LayoutList, Settings } from "lucide-react"
import type { RegistrationField } from "@/components/admin/form-builder"
import { FormFlowBuilder } from "@/components/admin/form-flow-builder"
import { FormSettings } from "@/components/admin/form-settings"

interface FormEditorTabsProps {
    form: any
    initialFields: RegistrationField[]
    formId: string
    answerCounts: Record<string, number>
}

export function FormEditorTabs({ form, initialFields, formId, answerCounts }: FormEditorTabsProps) {
    const [activeTab, setActiveTab] = useState<"questions" | "settings">("questions")

    const tabs = [
        { id: "questions" as const, label: "Sections & questions", icon: LayoutList },
        { id: "settings" as const, label: "Settings", icon: Settings },
    ]

    return (
        <div>
            {/* Tab bar */}
            <div className="flex gap-1 p-1 bg-[#141416] border border-[#27272a] rounded-xl mb-6 max-w-md">
                {tabs.map((tab) => {
                    const Icon = tab.icon
                    const isActive = activeTab === tab.id
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`relative flex-1 flex items-center justify-center gap-2 h-11 rounded-lg text-sm font-medium transition-colors ${
                                isActive ? "text-white" : "text-[#71717a] hover:text-[#a1a1aa]"
                            }`}
                        >
                            {isActive && (
                                <motion.div
                                    layoutId="activeTab"
                                    className="absolute inset-0 bg-[#27272a] rounded-lg"
                                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                />
                            )}
                            <span className="relative z-10 flex items-center gap-2">
                                <Icon className="w-4 h-4" />
                                {tab.label}
                            </span>
                        </button>
                    )
                })}
            </div>

            {/* Tab content */}
            {activeTab === "questions" && (
                <motion.div
                    key="questions"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3 }}
                >
                    <FormFlowBuilder initialFields={initialFields} formId={formId} answerCounts={answerCounts} />
                </motion.div>
            )}
            {activeTab === "settings" && (
                <motion.div
                    key="settings"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3 }}
                >
                    <FormSettings form={form} />
                </motion.div>
            )}
        </div>
    )
}
