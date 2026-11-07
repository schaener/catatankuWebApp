export const IS_DEMO = import.meta.env.VITE_DEMO === 'true';

/** Native confirm() is unavailable in some embedded previews; the demo skips it. */
export const confirmAction = (message) => IS_DEMO || window.confirm(message);
