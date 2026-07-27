// SPDX-FileCopyrightText: 2025 The BAR Lobby Authors
//
// SPDX-License-Identifier: MIT

import { getOAuthAuthorizationServerURL } from "@main/config/server";
import { logger } from "@main/utils/logger";
import { BrowserWindow, session } from "electron";

const PARTITION = "persist:oauth2";
const log = logger("auth-window");

// The authorization server keeps its own session cookie, so without dropping it
// here the next login silently reuses the same account instead of prompting.
export async function clearAuthSession() {
    await session.fromPartition(PARTITION).clearStorageData();
}

function getParentWindow() {
    const id = process.env.MAIN_WINDOW_ID ? Number.parseInt(process.env.MAIN_WINDOW_ID) : undefined;

    return id ? BrowserWindow.fromId(id) : null;
}

export default class AuthWindow {
    private window: BrowserWindow | null = null;
    private rejectOnDismissal?: (error: Error) => void;

    public open(url: string) {
        if (!url.startsWith(getOAuthAuthorizationServerURL())) {
            throw new Error("Refusing to open a login window for a URL outside the authorization server");
        }

        const parent = getParentWindow();

        this.window = new BrowserWindow({
            parent: parent ?? undefined,
            modal: !!parent,
            title: "Beyond All Reason",
            width: 560,
            height: 760,
            minimizable: false,
            maximizable: false,
            autoHideMenuBar: true,
            backgroundColor: "#000000",
            webPreferences: {
                partition: PARTITION,
                sandbox: true,
                nodeIntegration: false,
                contextIsolation: true,
                spellcheck: false,
            },
        });

        this.window.setMenuBarVisibility(false);

        this.window.webContents.setWindowOpenHandler(({ url: popupUrl }) => {
            log.warn(`Blocked popup from login page: ${popupUrl}`);

            return { action: "deny" };
        });

        this.window.webContents.on("did-navigate", (_event, navigatedUrl) => {
            this.window?.setTitle(new URL(navigatedUrl).origin);
        });

        this.window.on("closed", () => {
            this.window = null;
            this.rejectOnDismissal?.(new Error("Login window was closed"));
        });

        this.window.loadURL(url);
    }

    public dismissal(): Promise<never> {
        return new Promise((_resolve, reject) => {
            this.rejectOnDismissal = reject;
        });
    }

    public close() {
        this.rejectOnDismissal = undefined;
        if (!this.window) return;

        this.window.destroy();
        this.window = null;
    }
}
