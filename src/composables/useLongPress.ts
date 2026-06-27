import { onScopeDispose, ref } from "vue";

/**
 * Long-press gesture for pointer input. `action` fires after the press is held
 * for `durationMs` without moving more than a few pixels. `enabled` gates whether
 * a press should arm at all. `arming` is true while the timer is counting down
 * (for a visual cue), and `consumed()` returns true once per fire so the click
 * that follows a long press can be ignored.
 */
export function useLongPress(action: () => void, opts: { enabled?: () => boolean; durationMs?: number } = {}) {
    const duration = opts.durationMs ?? 500;
    const arming = ref(false);
    let timer: ReturnType<typeof setTimeout> | undefined;
    let fired = false;
    let startX = 0;
    let startY = 0;

    function down(e: PointerEvent) {
        fired = false;
        if (opts.enabled && !opts.enabled()) return;
        startX = e.clientX;
        startY = e.clientY;
        arming.value = true;
        clearTimeout(timer);
        timer = setTimeout(() => {
            arming.value = false;
            fired = true;
            action();
        }, duration);
    }
    function end() {
        arming.value = false;
        clearTimeout(timer);
    }
    function move(e: PointerEvent) {
        if (arming.value && (Math.abs(e.clientX - startX) > 10 || Math.abs(e.clientY - startY) > 10)) end();
    }
    /** True once after a long press fired — use to swallow the trailing click. */
    function consumed(): boolean {
        if (!fired) return false;
        fired = false;
        return true;
    }

    onScopeDispose(end);
    return { arming, down, end, move, consumed };
}
