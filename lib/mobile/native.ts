import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";
import { Keyboard } from "@capacitor/keyboard";
import { Haptics, ImpactStyle } from "@capacitor/haptics";

export const isNative = Capacitor.isNativePlatform();
export const platform = Capacitor.getPlatform();

export async function setNativeStatusBarStyle(isDark: boolean) {
  if (!isNative) return;
  try {
    await StatusBar.setStyle({
      style: isDark ? Style.Dark : Style.Light,
    });
    if (platform === "android") {
      await StatusBar.setBackgroundColor({
        color: isDark ? "#09090b" : "#ffffff",
      });
    }
  } catch {
    /* ignore if not supported */
  }
}

export async function triggerHaptic(style: ImpactStyle = ImpactStyle.Light) {
  if (!isNative) return;
  try {
    await Haptics.impact({ style });
  } catch {
    /* ignore */
  }
}

export function initNativeKeyboardListeners(onKeyboardChange?: (isOpen: boolean) => void) {
  if (!isNative) return () => {};
  try {
    const showSub = Keyboard.addListener("keyboardWillShow", () => {
      onKeyboardChange?.(true);
    });
    const hideSub = Keyboard.addListener("keyboardWillHide", () => {
      onKeyboardChange?.(false);
    });
    return () => {
      void showSub.then((s) => s.remove());
      void hideSub.then((s) => s.remove());
    };
  } catch {
    return () => {};
  }
}
