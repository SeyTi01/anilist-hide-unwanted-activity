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
// noinspection JSPrimitiveTypeWrapperUsage

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
    linkedConditions: [
        [],
    ],
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
        const checkCondition = (conditionName, predicate) => {
            return config[conditionName] && predicate(node) && !config.linkedConditions.some(innerArray => innerArray.includes(conditionName));
        };

        if (this.shouldRemoveByLinkedConditions(node)) {
            return true;
        }

        const conditions = [
            {name: 'remove.uncommented', predicate: this.shouldRemoveUncommented.bind(this)},
            {name: 'remove.unliked', predicate: this.shouldRemoveUnliked.bind(this)},
            {name: 'remove.images', predicate: this.shouldRemoveImage.bind(this)},
            {name: 'remove.videos', predicate: this.shouldRemoveVideo.bind(this)},
            {name: 'remove.customStrings', predicate: this.shouldRemoveByCustomStrings.bind(this)}
        ];

        for (let condition of conditions) {
            if (checkCondition(condition.name, condition.predicate)) {
                return true;
            }
        }

        return false;
    }

    shouldRemoveByLinkedConditions(node) {
        const answers = [];
        for (let i = 0; i < config.linkedConditions.length; i++) {
            const link = config.linkedConditions[i];
            const result = [];

            if (link.includes('remove.uncommented')) {
                result.push(this.shouldRemoveUncommented(node));
            }
            if (link.includes('remove.unliked')) {
                result.push(this.shouldRemoveUnliked(node));
            }
            if (link.includes('remove.images')) {
                result.push(this.shouldRemoveImage(node));
            }
            if (link.includes('remove.videos')) {
                result.push(this.shouldRemoveVideo(node));
            }
            if (link.includes('remove.customStrings')) {
                result.push(this.shouldRemoveByCustomStrings(node));
            }

            answers.push(!result.includes(false));
        }

        return answers.includes(true);
    }

    shouldRemoveUncommented(node) {
        return !this.hasElement(SELECTORS.span.count, node.querySelector(SELECTORS.div.replies));
    }

    shouldRemoveUnliked(node) {
        return !this.hasElement(SELECTORS.span.count, node.querySelector(SELECTORS.div.likes));
    }

    shouldRemoveImage(node) {
        return this.hasElement(SELECTORS.class.image, node);
    }

    shouldRemoveVideo(node) {
        return this.hasElement(SELECTORS.class.video, node);
    }

    shouldRemoveByCustomStrings(node) {
        return config.remove.customStrings.some((customString) =>
            (config.remove.caseSensitive ?
                node.textContent.includes(customString) :
                node.textContent.toLowerCase().includes(customString.toLowerCase()))
        );
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
            this.showCancel();
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
        this.hideCancel();
    }

    showCancel() {
        if (!this.cancel) {
            this.createCancel();
        } else {
            this.cancel.style.display = 'block';
        }
    }

    hideCancel() {
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

    createCancel() {
        this.cancel = Object.assign(document.createElement('button'), {
            textContent: 'Cancel',
            className: 'cancel-button',
            style: BUTTON_STYLE,
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

const BUTTON_STYLE = `
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
`;

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