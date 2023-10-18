// ==UserScript==
// @name         Anilist: Hide Unwanted Activity
// @namespace    https://github.com/SeyTi01/
// @version      1.8b
// @description  Customize activity feeds by removing unwanted entries.
// @author       SeyTi01
// @match        https://anilist.co/*
// @grant        none
// @license      MIT
// ==/UserScript==
// noinspection JSPrimitiveTypeWrapperUsage,JSUnusedGlobalSymbols

const config = {
    remove: {
        uncommented: true, // Remove activities that have no comments
        unliked: false, // Remove activities that have no likes
        text: false, // Remove activities containing only text
        images: false, // Remove activities containing images
        videos: false, // Remove activities containing videos
        containsStrings: [], // Remove activities containing user defined strings
        notContainsStrings: [], // Remove activities not containing user defined strings
    },
    options: {
        targetLoadCount: 2, // Minimum number of activities to show per click on the "Load More" button
        caseSensitive: false, // Whether string-based removal should be case-sensitive
        linkedConditions: [], // Groups of conditions to be checked together (linked conditions are always considered 'true')
    },
    runOn: {
        home: true, // Run the script on the home feed
        social: true, // Run the script on social feeds
        profile: false, // Run the script on user profile feeds
    },
};

class MainApp {
    constructor(activityHandler, uiHandler, config) {
        this.ac = activityHandler;
        this.ui = uiHandler;
        this.config = config;
    }

    observeMutations = (mutations) => {
        if (this.isAllowedUrl()) {
            for (const mutation of mutations) {
                if (mutation.addedNodes.length > 0) {
                    mutation.addedNodes.forEach(node => this.handleAddedNode(node));
                }
            }

            this.loadMoreOrReset();
        }
    }

    handleAddedNode = (node) => {
        if (node instanceof HTMLElement) {
            if (node.matches(SELECTORS.div.activity)) {
                this.ac.removeEntry(node);
            } else if (node.matches(SELECTORS.div.button)) {
                this.ui.setLoadMore(node);
            }
        }
    }

    loadMoreOrReset = () => {
        if (this.ac.currentLoadCount < this.config.options.targetLoadCount && this.ui.userPressed) {
            this.ui.clickLoadMore();
        } else {
            this.ac.resetState();
            this.ui.resetState();
        }
    }

    isAllowedUrl = () => {
        const allowedPatterns = Object.keys(this.URLS).filter(pattern => this.config.runOn[pattern]);

        return allowedPatterns.some(pattern => {
            const regex = new RegExp(this.URLS[pattern].replace('*', '.*'));
            return regex.test(window.location.href);
        });
    }

    initializeObserver = () => {
        this.observer = new MutationObserver(this.observeMutations);
        this.observer.observe(document.body, { childList: true, subtree: true });
    }

    URLS = {
        home: 'https://anilist.co/home',
        profile: 'https://anilist.co/user/*/',
        social: 'https://anilist.co/*/social',
    };
}

class ActivityHandler {
    constructor(config) {
        this.currentLoadCount = 0;
        this.config = config;
    }

    conditionsMap = new Map([
        ['uncommented', node => this.shouldRemoveUncommented(node)],
        ['unliked', node => this.shouldRemoveUnliked(node)],
        ['text', node => this.shouldRemoveText(node)],
        ['images', node => this.shouldRemoveImage(node)],
        ['videos', node => this.shouldRemoveVideo(node)],
        ['containsStrings', node => this.shouldRemoveStrings(node, true)],
        ['notContainsStrings', node => this.shouldRemoveStrings(node, false)],
    ]);

    removeEntry = (node) => {
        if (this.shouldRemoveNode(node)) {
            node.remove();
        } else {
            this.currentLoadCount++;
        }
    }

    resetState = () => {
        this.currentLoadCount = 0;
    }

    shouldRemoveNode = (node) => {
        const shouldRemoveByLinkedConditions = this.shouldRemoveLinkedConditions(node);
        const shouldRemoveByConditions = Array.from(this.conditionsMap.entries())
            .some(([name, predicate]) => this.shouldRemoveConditions(name, predicate, node));

        return shouldRemoveByLinkedConditions || shouldRemoveByConditions;
    }

    shouldRemoveLinkedConditions = (node) => {
        const { options: { linkedConditions } } = this.config;

        if (!linkedConditions || !Array.isArray(linkedConditions)) {
            return false;
        }

        const conditionsArray = linkedConditions.map(link => (Array.isArray(link) ? link : [link]));

        if (conditionsArray.length === 0) {
            return false;
        }

        return conditionsArray.some(link => link.length > 0)
            && conditionsArray.some(link => link.every(condition => this.conditionsMap.get(condition)(node)));
    }

    shouldRemoveConditions = (conditionName, predicate, node) => {
        const { remove, options: linkedConditions } = this.config;
        const conditionsArray = Array.isArray(linkedConditions) ? linkedConditions : [linkedConditions];

        if (remove && conditionsArray && conditionsArray.length > 0) {
            return remove[conditionName] && predicate(node);
        } else {
            return false;
        }
    }

    shouldRemoveUncommented = (node) => {
        return !node.querySelector(SELECTORS.div.replies)?.querySelector(SELECTORS.span.count);
    }

    shouldRemoveUnliked = (node) => {
        return !node.querySelector(SELECTORS.div.likes)?.querySelector(SELECTORS.span.count);
    }

    shouldRemoveText = (node) => {
        return (node.classList.contains(SELECTORS.activity.text) || node.classList.contains(SELECTORS.activity.message))
            && !(this.shouldRemoveImage(node) || this.shouldRemoveVideo(node));
    }

    shouldRemoveImage = (node) => {
        return node?.querySelector(SELECTORS.class.image);
    }

    shouldRemoveVideo = (node) => {
        return node?.querySelector(SELECTORS.class.video) || node?.querySelector(SELECTORS.span.youTube);
    }

    shouldRemoveStrings = (node, shouldContain) => {
        const { remove: { containsStrings, notContainsStrings }, options: { caseSensitive } } = this.config;

        const isEmptyArray = arr => Array.isArray(arr) && arr.length === 0;

        if ((!notContainsStrings || isEmptyArray(notContainsStrings) || notContainsStrings.every(isEmptyArray))
            && (!shouldContain || isEmptyArray(containsStrings) || containsStrings.every(isEmptyArray))) {
            return false;
        }

        const checkStrings = (strings) => {
            const checkString = str => this.containsString(node.textContent, str, caseSensitive, true);
            return Array.isArray(strings) ? strings.every(checkString) : checkString(strings);
        };

        if (shouldContain) {
            return containsStrings.some(strings => checkStrings(strings, true));
        } else {
            return !notContainsStrings.some(strings => checkStrings(strings, false));
        }
    };

    containsString = (nodeText, strings, caseSensitive, shouldContain) => {
        const checkIncludes = str => {
            const text = caseSensitive ? nodeText : nodeText.toLowerCase();
            const string = caseSensitive ? str : str.toLowerCase();
            return text.includes(string);
        };

        if (Array.isArray(strings)) {
            return strings.some(str => shouldContain ? checkIncludes(str) : !checkIncludes(str));
        } else {
            return shouldContain ? checkIncludes(strings) : !checkIncludes(strings);
        }
    };
}

class UIHandler {
    constructor() {
        this.userPressed = true;
        this.cancel = null;
        this.loadMore = null;
    }

    setLoadMore = (button) => {
        this.loadMore = button;
        this.loadMore.addEventListener('click', () => {
            this.userPressed = true;
            this.simulateDomEvents();
            this.showCancel();
        });
    };

    clickLoadMore = () => {
        if (this.loadMore) {
            this.loadMore.click();
            this.loadMore = null;
        }
    };

    resetState = () => {
        this.userPressed = false;
        this.hideCancel();
    };

    showCancel = () => {
        if (!this.cancel) {
            this.createCancel();
        } else {
            this.cancel.style.display = 'block';
        }
    };

    hideCancel = () => {
        if (this.cancel) {
            this.cancel.style.display = 'none';
        }
    };

    simulateDomEvents = () => {
        const domEvent = new Event('scroll', { bubbles: true });
        const intervalId = setInterval(() => {
            if (this.userPressed) {
                window.dispatchEvent(domEvent);
            } else {
                clearInterval(intervalId);
            }
        }, 100);
    };

    createCancel = () => {
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
    };
}

class ConfigValidator {
    constructor(config) {
        this.config = config;
        this.errors = [];
    }

    validate() {
        const { options } = this.config;

        const booleanKeys = [
            'remove.uncommented',
            'remove.unliked',
            'remove.text',
            'remove.images',
            'remove.videos',
            'options.caseSensitive',
            'runOn.home',
            'runOn.social',
            'runOn.profile',
        ];

        const arrayKeys = [
            'remove.containsStrings',
            'remove.notContainsStrings',
            'options.linkedConditions',
        ];

        this.validateBooleans(booleanKeys);
        this.validatePositiveNonZeroInteger('options.targetLoadCount', options.targetLoadCount);
        this.validateArraysOfStrings(arrayKeys);

        if (this.errors.length > 0) {
            const errorMessage = `Script disabled due to configuration errors: ${this.errors.join(', ')}`;
            throw new Error(errorMessage);
        }
    }

    validateBooleans(keys) {
        for (const key of keys) {
            if (typeof this.getConfigValue(key) !== 'boolean') {
                this.errors.push(`${key} should be a boolean`);
            }
        }
    }

    validatePositiveNonZeroInteger(key, value) {
        if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
            this.errors.push(`${key} should be a positive non-zero integer`);
        }
    }

    validateArraysOfStrings(keys) {
        for (const key of keys) {
            const value = this.getConfigValue(key);
            if (!Array.isArray(value) || !value.every(item => this.isArrayOfStrings(item))) {
                this.errors.push(`${key} should be an array of strings or an array of arrays of strings`);
            }
        }
    }

    isArrayOfStrings(arr) {
        return Array.isArray(arr) && arr.every(item => typeof item === 'string');
    }

    getConfigValue(key) {
        const keys = key.split('.');
        let value = this.config;
        for (const k of keys) {
            value = value[k];
            if (value === undefined) {
                return undefined;
            }
        }
        return value;
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
        youTube: 'span.youtube',
    },
    activity: {
        text: 'activity-text',
        message: 'activity-message',
    },
    class: {
        image: 'img',
        video: 'video',
    },
};

function main() {
    try {
        new ConfigValidator(config).validate();
    } catch (error) {
        console.error(error.message);
        return;
    }

    const activityHandler = new ActivityHandler(config);
    const uiHandler = new UIHandler();
    const mainApp = new MainApp(activityHandler, uiHandler, config);

    mainApp.initializeObserver();
}

if (require.main === module) {
    main();
}

module.exports = { MainApp, ActivityHandler, UIHandler, config, SELECTORS };