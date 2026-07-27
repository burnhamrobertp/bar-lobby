<!--
SPDX-FileCopyrightText: 2025 The BAR Lobby Authors

SPDX-License-Identifier: MIT
-->

<route lang="json5">
{ meta: { empty: true, blurBg: true, transition: { name: "fade" } } }
</route>

<template>
    <div class="container">
        <img ref="logo" class="logo" src="/src/renderer/assets/images/BARLogoFull.png" />
        <Transition mode="out-in" name="fade">
            <div v-if="connecting">
                <div class="relative">
                    <Loader></Loader>
                </div>
                <Transition :appear="true" name="delayed-fade">
                    <button class="go-back-button" @click="abort">{{ t("lobby.views.index.goBack") }}</button>
                </Transition>
            </div>
            <div v-else class="buttons-container">
                <button class="login-button" @click="login">{{ t("lobby.views.index.login") }}</button>
                <div v-if="hasCredentials" class="play-offline" @click="changeAccount">{{ t("lobby.views.index.changeAccount") }}</div>
                <div v-if="error" class="txt-error">{{ error }}</div>
                <div class="play-offline" @click="playOffline">{{ t("lobby.views.index.playOffline") }}</div>
            </div>
        </Transition>
    </div>
    <div v-if="loginViewOpen" class="login-overlay">
        <div class="login-panel">
            <div class="login-panel-header">
                <span>{{ t("lobby.views.index.login") }}</span>
                <button class="login-panel-close" @click="cancelLogin">&times;</button>
            </div>
            <div ref="loginViewSlot" class="login-view-slot"></div>
        </div>
    </div>
</template>

<script lang="ts" setup>
import { nextTick, onBeforeUnmount, onActivated, ref, useTemplateRef } from "vue";
import { useTypedI18n } from "@renderer/i18n";

import Loader from "@renderer/components/common/Loader.vue";
import { useRouter } from "vue-router";
import { auth } from "@renderer/store/me.store";
import { settingsStore } from "@renderer/store/settings.store";
import { tachyon } from "@renderer/store/tachyon.store";

const { t } = useTypedI18n();

const router = useRouter();

const connecting = ref(false);
const error = ref<string>();

const loginViewOpen = ref(false);
const loginViewSlot = useTemplateRef<HTMLElement>("loginViewSlot");
let slotObserver: ResizeObserver | undefined;

function reportLoginViewBounds() {
    if (!loginViewSlot.value) return;

    const { x, y, width, height } = loginViewSlot.value.getBoundingClientRect();
    window.auth.setLoginViewBounds({ x, y, width, height });
}

window.auth.onLoginViewOpened(async () => {
    loginViewOpen.value = true;
    await nextTick();
    if (!loginViewSlot.value) return;

    reportLoginViewBounds();
    slotObserver = new ResizeObserver(reportLoginViewBounds);
    slotObserver.observe(loginViewSlot.value);
    window.addEventListener("resize", reportLoginViewBounds);
});

function teardownLoginView() {
    loginViewOpen.value = false;
    slotObserver?.disconnect();
    slotObserver = undefined;
    window.removeEventListener("resize", reportLoginViewBounds);
}

window.auth.onLoginViewClosed(teardownLoginView);
onBeforeUnmount(teardownLoginView);

function cancelLogin() {
    window.auth.cancelLogin();
}

const hasCredentials = ref(false);
onActivated(async () => {
    hasCredentials.value = await window.auth.hasCredentials();

    if (router.currentRoute.value.query.login === "true") {
        const query = { ...router.currentRoute.value.query };
        delete query.login;
        await router.replace({ path: "/", query });
        await login();
    }
});

async function login() {
    try {
        error.value = "";
        connecting.value = true;
        if ((await auth.login()) === "cancelled") return;

        await tachyon.connect();
        const redirect = router.currentRoute.value.query.redirect as string | undefined;
        router.push(redirect || "/play");
    } catch (e) {
        console.error(e);
        error.value = (e as Error).message;
    } finally {
        // Removes the stutter when transitioning to the next page
        setTimeout(() => {
            connecting.value = false;
        }, 1000);
    }
}

async function abort() {
    connecting.value = false;
    error.value = "";
    await auth.logout();
    router.push("/");
}

async function changeAccount() {
    await auth.changeAccount();
    hasCredentials.value = false;
    login();
}

async function playOffline() {
    auth.playOffline();
    router.push("/play");
}

if (hasCredentials.value && settingsStore.loginAutomatically) {
    console.log("Logging in automatically");
    login();
}
</script>

<style lang="scss" scoped>
.container {
    position: relative;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    margin-top: calc((100vh - 900px) / 2);
    width: 500px;
    margin-left: auto;
    margin-right: auto;
}

.login-overlay {
    position: fixed;
    inset: 0;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.6);
}

.logo {
    filter: drop-shadow(3px 3px 5px rgba(0, 0, 0, 0.8));
    margin-bottom: 80px;
}

.login-panel {
    display: flex;
    flex-direction: column;
    width: 720px;
    height: 800px;
    max-width: 92vw;
    max-height: 90vh;
    background: rgba(0, 0, 0, 0.85);
    border: 1px solid rgba(255, 255, 255, 0.15);
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.6);
}

.login-panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 8px 8px 16px;
    font-family: Rajdhani;
    font-weight: bold;
    font-size: 1.2rem;
    text-transform: uppercase;
    border-bottom: 1px solid rgba(255, 255, 255, 0.15);
}

.login-panel-close {
    padding: 0 12px;
    font-size: 1.8rem;
    line-height: 1;
    color: #fff;
    opacity: 0.5;
    &:hover {
        opacity: 1;
    }
}

.login-view-slot {
    flex: 1;
}

.play-offline {
    display: flex;
    align-self: center;
    margin-top: 20px;
    font-size: 32px;
    opacity: 0.3;
    &:hover {
        opacity: 1;
    }
}

.go-back-button {
    display: flex;
    align-self: center;
    margin-top: 42px;
    font-size: 32px;
    opacity: 0.3;
    &:hover {
        opacity: 1;
    }
}

.login-button {
    align-self: center;
    width: 500px;
    text-transform: uppercase;
    font-family: Rajdhani;
    font-weight: bold;
    font-size: 2rem;
    padding: 20px 40px;
    color: #fff;
    background: linear-gradient(90deg, #22c55e, #16a34a);
    border: none;
    border-radius: 2px;
    box-shadow: 0 0 15px rgba(34, 197, 94, 0.4);
    text-align: center;
    cursor: pointer;
    position: relative;
    overflow: hidden;
    transition:
        transform 0.3s ease,
        box-shadow 0.3s ease;
}

.login-button:hover {
    box-shadow: 0 0 25px rgba(34, 197, 94, 0.6);
}

.login-button::before {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 200%;
    height: 200%;
    background: rgba(255, 255, 255, 0.2);
    transform: translate(-50%, -50%) scale(0);
    border-radius: 50%;
    transition: transform 0.4s ease;
}

.login-button:hover::before {
    box-shadow: 0 0 15px rgba(34, 197, 94, 0.4);
}

.buttons-container {
    display: flex;
    gap: 20px;
    flex-direction: column;
    align-items: center;
}

.delayed-fade-enter-active {
    animation: fadeIn 0.5s ease-in-out;
    animation-delay: 2s;
    animation-fill-mode: both;
}

@keyframes fadeIn {
    from {
        opacity: 0;
    }
    to {
        opacity: 0.3;
    }
}
</style>
