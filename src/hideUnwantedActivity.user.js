// ==UserScript==
// @name         Anilist: Hide Unwanted Activity
// @namespace    https://github.com/SeyTi01/
// @version      1.7b
// @description  Customize activity feeds by removing unwanted entries.
// @author       SeyTi01
// @match        https://anilist.co/*
// @grant        none
// @license      MIT
// ==/UserScript==

const config = {
    targetLoadCount: 2, // Minimum number of activities to show per click on the "Load More" button
    remove: {
        uncommented: true, // Remove activities that have no comments
        unliked: false, // Remove activities that have no likes
        images: false, // Remove activities containing images
        videos: false, // Remove activities containing videos
        customStrings: [], // Remove activities with user-defined strings
        caseSensitive: false, // Whether string removal should be case-sensitive
    },
    runOn: {
        home: true, // Run the script on the home feed
        social: true, // Run the script on social feeds
        profile: false, // Run the script on user profile feeds
    },
};

class MainApp {

    constructor(activityHandler, uiHandler) {
        this.ac = activityHandler;
        this.ui = uiHandler;
    }

    observeMutations(mutations) {
        if (this.isAllowedUrl()) {
            for (const mutation of mutations) {
                if (mutation.addedNodes.length > 0) {
                    mutation.addedNodes.forEach(node => this.handleAddedNode(node));
                }
            }

            this.loadMoreOrReset();
        }
    }

    handleAddedNode(node) {
        if (node instanceof HTMLElement) {
            if (node.matches(SELECTORS.div.activity)) {
                this.ac.removeEntry(node);
            } else if (node.matches(SELECTORS.div.button)) {
                this.ui.setLoadMore(node);
            }
        }
    }

    loadMoreOrReset() {
        if (this.ac.currentLoadCount < config.targetLoadCount && this.ui.userPressed) {
            this.ui.clickLoadMore();
        } else {
            this.ac.resetState();
            this.ui.resetState();
        }
    }

    isAllowedUrl() {
        const currentUrl = window.location.href;
        const allowedPatterns = Object.keys(URLS).filter(pattern => config.runOn[pattern]);

        return allowedPatterns.some(pattern => {
            const regex = new RegExp(URLS[pattern].replace('*', '.*'));
            return regex.test(currentUrl);
        });
    }

    initializeObserver() {
        this.observer = new MutationObserver(this.observeMutations.bind(this));
        this.observer.observe(document.body, {childList: true, subtree: true});
    }
}

class ActivityHandler {

    constructor() {
        this.currentLoadCount = 0;
    }

    removeEntry(node) {
        if (this.shouldRemoveNode(node)) {
            node.remove();
        } else {
            this.currentLoadCount++;
        }
    }

    resetState() {
        this.currentLoadCount = 0;
    }

    shouldRemoveNode(node) {
        return (
            this.shouldRemoveUncommented(node) ||
            this.shouldRemoveUnliked(node) ||
            this.shouldRemoveImage(node) ||
            this.shouldRemoveVideo(node) ||
            this.shouldRemoveByCustomStrings(node)
        );
    }

    shouldRemoveUncommented(node) {
        if (config.remove.uncommented) {
            return !this.hasElement(SELECTORS.span.count, node.querySelector(SELECTORS.div.replies));
        }
        return false;
    }

    shouldRemoveUnliked(node) {
        if (config.remove.unliked) {
            return !this.hasElement(SELECTORS.span.count, node.querySelector(SELECTORS.div.likes));
        }
        return false;
    }

    shouldRemoveImage(node) {
        if (config.remove.images) {
            return this.hasElement(SELECTORS.class.image, node);
        }
        return false;
    }

    shouldRemoveVideo(node) {
        if (config.remove.videos) {
            return this.hasElement(SELECTORS.class.video, node);
        }
        return false;
    }

    shouldRemoveByCustomStrings(node) {
        return config.remove.customStrings.some((customString) => {
            return config.remove.caseSensitive ?
                node.textContent.includes(customString) :
                node.textContent.toLowerCase().includes(customString.toLowerCase());
        });
    }

    hasElement(selector, node) {
        return node?.querySelector(selector);
    }
}

class UIHandler {

    constructor() {
        this.userPressed = true;
        this.cancel = null;
        this.loadMore = null;
    }

    setLoadMore(button) {
        this.loadMore = button;
        this.loadMore.addEventListener('click', () => {
            this.userPressed = true;
            this.simulateDomEvents();
            this.showCancelButton();
        });
    }

    clickLoadMore() {
        if (this.loadMore) {
            this.loadMore.click();
            this.loadMore = null;
        }
    }

    resetState() {
        this.userPressed = false;
        this.hideCancelButton();
    }

    showCancelButton() {
        if (!this.cancel) {
            this.createCancelButton();
        } else {
            this.cancel.style.display = 'block';
        }
    }

    hideCancelButton() {
        if (this.cancel) {
            this.cancel.style.display = 'none';
        }
    }

    simulateDomEvents() {
        const domEvent = new Event('scroll', {bubbles: true});
        const intervalId = setInterval(() => {
            if (this.userPressed) {
                window.dispatchEvent(domEvent);
            } else {
                clearInterval(intervalId);
            }
        }, 100);
    }

    createCancelButton() {
        this.cancel = Object.assign(document.createElement('button'), {
            textContent: 'Cancel',
            className: 'cancel-button',
            style: `
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
            --button-color: rgb(var(--color-blue));
        `,
            onclick: () => {
                this.userPressed = false;
                this.cancel.style.display = 'none';
            },
        });

        document.body.appendChild(this.cancel);
    }
}

class ConfigValidator {

    static validate(config) {
        const errors = [
            typeof config.remove.uncommented !== 'boolean' && 'remove.uncommented must be a boolean',
            typeof config.remove.unliked !== 'boolean' && 'remove.unliked must be a boolean',
            typeof config.remove.images !== 'boolean' && 'remove.images must be a boolean',
            typeof config.remove.videos !== 'boolean' && 'remove.videos must be a boolean',
            (!Number.isInteger(config.targetLoadCount) || config.targetLoadCount < 1) && 'targetLoadCount must be a positive non-zero integer',
            typeof config.runOn.home !== 'boolean' && 'runOn.home must be a boolean',
            typeof config.runOn.profile !== 'boolean' && 'runOn.profile must be a boolean',
            typeof config.runOn.social !== 'boolean' && 'runOn.social must be a boolean',
            !Array.isArray(config.remove.customStrings) && 'remove.customStrings must be an array',
            config.remove.customStrings.some((str) => typeof str !== 'string') && 'remove.customStrings must only contain strings',
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
    div: {
        button: 'div.load-more',
        activity: 'div.activity-entry',
        replies: 'div.action.replies',
        likes: 'div.action.likes',
    },
    span: {
        count: 'span.count',
    },
    class: {
        image: 'img',
        video: 'video',
    }
};

const URLS = {
    home: 'https://anilist.co/home',
    profile: 'https://anilist.co/user/*/',
    social: 'https://anilist.co/*/social',
};

(function() {
    'use strict';

    if (!ConfigValidator.validate(config)) {
        console.error('Script disabled due to configuration errors.');
        return;
    }

    const activityHandler = new ActivityHandler();
    const uiHandler = new UIHandler();
    const mainApp = new MainApp(activityHandler, uiHandler);

    mainApp.initializeObserver();
})();