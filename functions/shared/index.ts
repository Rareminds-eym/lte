// Shared backend utilities

export const generateId = (prefix: string = ""): string => {
	const id = Math.random().toString(36).substr(2, 9);
	return prefix ? `${prefix}-${id}` : id;
};

export const getCurrentTimestamp = (): string => {
	return new Date().toISOString();
};

export const sleep = (ms: number): Promise<void> => {
	return new Promise((resolve) => setTimeout(resolve, ms));
};

export const safeJsonParse = <T>(json: string, fallback: T): T => {
	try {
		return JSON.parse(json) as T;
	} catch {
		return fallback;
	}
};

export * from "./types";
