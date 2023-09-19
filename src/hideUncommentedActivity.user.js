// ==UserScript==
// @name         Anilist: Hide Unwanted Activity
// @namespace    https://github.com/SeyTi01/
// @version      1.6b
// @description  Hides unwanted activity on Anilist's activity feeds
// @author       SeyTi01
// @match        https://anilist.co/*
// @grant        none
// @license      MIT
// ==/UserScript==

const config = {
    targetLoadCount: 2, // Number of activities to show per click on the "Load More" button
    remove: {
        uncommented: true, // Remove activities that have no comments
        unliked: false, // Remove activities that have no likes
        customStrings: [], // Remove activities with user-defined strings
        caseSensitive: false, // Whether string removal should be case-sensitive
    },
    runOn: {
        home: true, // Run the script on the home feed
        profile: true, // Run the script on user profile feeds
        social: true, // Run the script on social feeds
    },
};

class AnilistActivityManager {

    constructor(config) {
        this.config = config;
        this.currentLoadCount = 0;
        this.userPressedButton = true;
        this.loadMoreButton = null;
        this.cancelButton = null;
        this.initializeObserver();
    }

    observeMutations(mutations) {
        if (this.isAllowedUrl()) {
            for (const mutation of mutations) {
                if (mutation.addedNodes.length > 0) {
                    mutation.addedNodes.forEach(this.handleAddedNode.bind(this));
                }
            }
        }

        if (this.currentLoadCount < this.config.targetLoadCount && this.userPressedButton) {
            this.clickLoadMoreButton();
        } else {
            this.resetState();
        }
    }

    handleAddedNode(node) {
        if (!(node instanceof HTMLElement)) {
            return;
        }

        if (node.matches(SELECTORS.activity)) {
            if (!this.removeEntry(node)) {
                this.currentLoadCount++;
            }

        } else if (node.matches(SELECTORS.button)) {
            this.handleLoadMoreButton(node);
        }
    }

    removeEntry(node) {
        if (
            this.shouldRemoveUncommented(node) ||
            this.shouldRemoveUnliked(node) ||
            this.shouldRemoveByCustomStrings(node)
        ) {
            node.remove();
            return true;
        }

        return false;
    }

    handleLoadMoreButton(button) {
        this.loadMoreButton = button;
        this.loadMoreButton.addEventListener('click', () => {
            this.userPressedButton = true;
            this.simulateDomEvents();
            this.showCancelButton();
        });
    }

    showCancelButton() {
        if (!this.cancelButton) {
            this.createCancelButton();
        } else {
            this.cancelButton.style.display = 'block';
        }
    }

    initializeObserver() {
        if (!this.validateConfig(this.config)) {
            console.error('Script disabled due to configuration errors.');
        } else {
            const observer = new MutationObserver(this.observeMutations.bind(this));
            observer.observe(document.body, { childList: true, subtree: true });
        }
    }

    simulateDomEvents() {
        const domEvent = new Event('scroll', { bubbles: true });
        const intervalId = setInterval(() => {
            if (this.userPressedButton) {
                window.dispatchEvent(domEvent);
            } else {
                clearInterval(intervalId);
            }
        }, 100);
    }

    clickLoadMoreButton() {
        if (this.loadMoreButton) {
            this.loadMoreButton.click();
            this.loadMoreButton = null;
        }
    }

    resetState() {
        this.currentLoadCount = 0;
        this.userPressedButton = false;
        if (this.cancelButton) {
            this.cancelButton.style.display = 'none';
        }
    }

    hasCountSpan(node) {
        return node?.querySelector('span.count');
    }

    isAllowedUrl() {
        const currentUrl = window.location.href;
        return (
            (this.config.runOn.home && new RegExp(URLS.home.replace('*', '.*')).test(currentUrl)) ||
            (this.config.runOn.profile && new RegExp(URLS.profile.replace('*', '.*')).test(currentUrl)) ||
            (this.config.runOn.social && new RegExp(URLS.social.replace('*', '.*')).test(currentUrl))
        );
    }

    shouldRemoveUncommented(node) {
        if (this.config.remove.uncommented) {
            return !this.hasCountSpan(node.querySelector(SELECTORS.replies));
        }
        return false;
    }

    shouldRemoveUnliked(node) {
        if (this.config.remove.unliked) {
            return !this.hasCountSpan(node.querySelector(SELECTORS.likes));
        }
        return false;
    }

    shouldRemoveByCustomStrings(node) {
        return this.config.remove.customStrings.some((customString) => {
            return this.config.remove.caseSensitive
                ? node.textContent.includes(customString)
                : node.textContent.toLowerCase().includes(customString.toLowerCase());
        });
    }

    createCancelButton() {
        const buttonStyles = `
                position: fixed;
                bottom: 10px;
                right: 10px;
                z-index: 9999;
                line-height: 1.3;
                background-color: rgb(var(--color-background-blue-dark));
                color: rgb(var(--color-text-bright));
                font: 1.6rem 'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', Oxygen, Ubuntu, Cantarell, 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
                -webkit-font-smoothing: antialiased;
                box-sizing: border-box;
            `;

        this.cancelButton = Object.assign(document.createElement('button'), {
            textContent: 'Cancel',
            className: 'cancel-button',
            style: `--button-color: rgb(var(--color-blue)); ${buttonStyles}`,
            onclick: () => {
                this.userPressedButton = false;
                this.cancelButton.style.display = 'none';
            },
        });

        document.body.appendChild(this.cancelButton);
    }

    validateConfig(config) {
        const errors = [
            typeof config.remove.uncommented !== 'boolean' && 'remove.uncommented must be a boolean',
            typeof config.remove.unliked !== 'boolean' && 'remove.unliked must be a boolean',
            (!Number.isInteger(config.targetLoadCount) || config.targetLoadCount < 1) &&
            'targetLoadCount must be a positive non-zero integer',
            typeof config.runOn.home !== 'boolean' && 'runOn.home must be a boolean',
            typeof config.runOn.profile !== 'boolean' && 'runOn.profile must be a boolean',
            typeof config.runOn.social !== 'boolean' && 'runOn.social must be a boolean',
            !Array.isArray(config.remove.customStrings) && 'remove.customStrings must be an array',
            config.remove.customStrings.some((str) => typeof str !== 'string') &&
            'remove.customStrings must only contain strings',
            typeof config.remove.caseSensitive !== 'boolean' && 'remove.caseSensitive must be a boolean',
        ].filter(Boolean);

        if (errors.length > 0) {
            console.error('Script configuration errors:');
            errors.forEach((error) => console.error(error));
            return false;
        }

        return true;
    }
}

const SELECTORS = {
    button: 'div.load-more',
    activity: 'div.activity-entry',
    replies: 'div.action.replies',
    likes: 'div.action.likes',
};

const URLS = {
    home: 'https://anilist.co/home',
    profile: 'https://anilist.co/user/*/',
    social: 'https://anilist.co/*/social',
};

(function () {
    'use strict';
    new AnilistActivityManager(config);
})();