import { createApp } from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router';
import { createPinia } from 'pinia'
import "./style.css"
import '@mdi/font/css/materialdesignicons.css'
import App from './App.vue'
import './samples/node-api'
import 'vuetify/styles'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import { devices } from 'node-hid';
import { VueQueryPlugin } from "@tanstack/vue-query";
import { routes } from '@/router';
import '@fortawesome/fontawesome-free/css/all.css';

interface DecodedToken {
    permissions?: string[];
    exp?: number;
    [key: string]: any;
}

const router = createRouter({
    // 4. Provide the history implementation to use. We are using the hash history for simplicity here.
    history: createWebHashHistory(),
    routes, // short for `routes: routes`
  });

// TODO RBAC service
// router.beforeEach(() => {
//
// });

console.log(devices());

const vuetify = createVuetify({
    components,
    directives,
    icons: {
        defaultSet: 'mdi'
    },
    theme: {
        defaultTheme: 'light',
        themes: {
            light: {
                dark: false,
                colors: {
                    background: '#ffffff',
                    primary: '#12004a',
                    warning: '#e67e22',
                    save: '#28b463',
                    decline: '#c0392b'
                },
            },
            dark: {
                dark: true,
                colors: {
                    background: '#121212',
                    primary: '#457ec7',
                    warning: '#e67e22',
                    save: '#28b463',
                    decline: '#c0392b'
                },
            },
        },
    },
});

const pinia = createPinia()


createApp(App)
    .use(vuetify)
    .use(router)
    .use(VueQueryPlugin)
    .use(pinia)
    .mount('#app')
    .$nextTick(() => {
        postMessage({ payload: 'removeLoading' }, '*')
    })
