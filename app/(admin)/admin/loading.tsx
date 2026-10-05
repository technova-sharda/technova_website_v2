import { Skeleton, SkeletonStats, SkeletonTable } from '@/components/ui/skeleton'

export default function AdminLoading() {
    return (
        <div className="space-y-6">
            {/* Header Skeleton */}
            <div className="flex items-center justify-between">
                <div className="space-y-2">
                    <div className="flex items-center gap-3">
                        <Skeleton className="h-8 w-8 rounded" />
                        <Skeleton className="h-10 w-48" />
                    </div>
                    <Skeleton className="h-5 w-64" />
                </div>
                <Skeleton className="h-10 w-40 rounded-full" />
            </div>

            {/* Stats Grid Skeleton */}
            <SkeletonStats />

            {/* Quick Actions Skeleton */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="p-4 rounded-xl bg-white/[0.03] border border-white/10 text-center">
                        <Skeleton className="h-6 w-6 mx-auto mb-2 rounded" />
                        <Skeleton className="h-4 w-20 mx-auto" />
                    </div>
                ))}
            </div>

            {/* Content Grid Skeleton */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <SkeletonTable rows={5} />
                <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-6 space-y-4">
                    <Skeleton className="h-6 w-40" />
                    <div className="space-y-3">
                        <Skeleton className="h-12 w-full rounded-xl" />
                        <div className="grid grid-cols-2 gap-4">
                            <Skeleton className="h-20 w-full rounded-xl" />
                            <Skeleton className="h-20 w-full rounded-xl" />
                        </div>
                        <Skeleton className="h-16 w-full rounded-xl" />
                    </div>
                </div>
            </div>
        </div>
    )
}
