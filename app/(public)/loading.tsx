/**
 * Shown while a public page renders on the server. Deliberately quiet: the page
 * background plus a thin progress bar that only fades in if loading takes longer
 * than 300 ms, so fast loads don't flash a splash screen. Pure CSS (no JS needed).
 */
export default function PublicLoading() {
    return (
        <div className="min-h-screen bg-[var(--sig-bg)]" aria-busy="true" aria-label="Loading">
            <div className="fixed top-0 inset-x-0 z-[70] h-[2px] overflow-hidden opacity-0 [animation:hero-fade_0.3s_ease-out_300ms_forwards]">
                <div className="h-full w-1/3 bg-gradient-to-r from-transparent via-[var(--sig-amber)] to-transparent [animation:loading-sweep_1.1s_cubic-bezier(0.65,0,0.35,1)_infinite]" />
            </div>
        </div>
    )
}
