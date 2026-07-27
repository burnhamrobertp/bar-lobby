// SPDX-FileCopyrightText: 2025 The BAR Lobby Authors
//
// SPDX-License-Identifier: MIT

import { getOAuthAuthorizationServerURL } from "@main/config/server";
import { typedWebContents } from "@main/typed-ipc";
import { logger } from "@main/utils/logger";
import { BrowserWindow, Rectangle, session, WebContentsView } from "electron";

const PARTITION = "persist:oauth2";
const log = logger("auth-view");

export class LoginCancelledError extends Error {}

// The authorization server keeps its own session cookie, so without dropping it
// here the next login silently reuses the same account instead of prompting.
export async function clearAuthSession() {
    await session.fromPartition(PARTITION).clearStorageData();
}

function getMainWindow() {
    const id = process.env.MAIN_WINDOW_ID ? Number.parseInt(process.env.MAIN_WINDOW_ID) : undefined;

    return id ? BrowserWindow.fromId(id) : null;
}

class AuthView {
    private view: WebContentsView | null = null;
    private window: BrowserWindow | null = null;
    private rejectOnCancel?: (error: Error) => void;

    public open(url: string) {
        if (!url.startsWith(getOAuthAuthorizationServerURL())) {
            throw new Error("Refusing to load a login page from outside the authorization server");
        }

        const window = getMainWindow();
        if (!window) throw new Error("Cannot show the login page without a main window");

        this.window = window;
        this.view = new WebContentsView({
            webPreferences: {
                partition: PARTITION,
                sandbox: true,
                nodeIntegration: false,
                contextIsolation: true,
                spellcheck: false,
            },
        });

        // Stays hidden until the renderer reports where its login panel ended up.
        this.view.setVisible(false);
        window.contentView.addChildView(this.view);

        this.view.webContents.setWindowOpenHandler(({ url: popupUrl }) => {
            log.warn(`Blocked popup from login page: ${popupUrl}`);

            return { action: "deny" };
        });

        this.view.webContents.loadURL(url);
        typedWebContents(window.webContents).send("auth:loginViewOpened");
    }

    public setBounds(bounds: Rectangle) {
        if (!this.view || !this.window) return;

        const zoom = this.window.webContents.getZoomFactor();
        this.view.setBounds({
            x: Math.round(bounds.x * zoom),
            y: Math.round(bounds.y * zoom),
            width: Math.round(bounds.width * zoom),
            height: Math.round(bounds.height * zoom),
        });
        // Match the main window's zoom so the login page scales with the rest of the UI.
        this.view.webContents.setZoomFactor(zoom);
        this.view.setVisible(true);
    }

    public cancel() {
        this.rejectOnCancel?.(new LoginCancelledError("Login was cancelled"));
    }

    public dismissal(): Promise<never> {
        return new Promise((_resolve, reject) => {
            this.rejectOnCancel = reject;
        });
    }

    public close() {
        this.rejectOnCancel = undefined;
        if (!this.view || !this.window) return;

        this.window.contentView.removeChildView(this.view);
        this.view.webContents.close();
        typedWebContents(this.window.webContents).send("auth:loginViewClosed");
        this.view = null;
        this.window = null;
    }
}

export const authView = new AuthView();
