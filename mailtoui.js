/*

MailtoUI - A convenient drop-in user interface for mailto links.

A project by Mario Rodriguez (@mariordev).

MailtoUI is a drop-in script that gives mailto links a convenient UI, which allows
users to select from popular web email clients to compose a new message from
their own email account. MailtoUI is written in vanilla JavaScript, so
it's lean and doesn't have any dependencies to be concerned with.

Read the full documentation at https://mailtoui.com.

*/

// Let's not step on anybody else's toes.
var mailtouiApp = mailtouiApp || {};

(function (app) {
    /**
     * Keep track of the modal currently open.
     */
    var activeModal = null;

    /**
     * List of focusable elements within modal.
     */
    var focusable = 'a[href], input:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])';

    /**
     * The last document element to have focus before the modal was opened.
     * Focus is to be set back on this element after the modal is closed.
     */
    var lastDocElementFocused = null;

    /**
     * User options set via data-options attribute on script tag.
     */
    var options = new Object();

    /**
     * Allows for a custom class to namespace css classes.
     */
    options.linkClass = 'mailtoui';

    /**
     * When set to true, the modal is closed automatically when email client is clicked.
     */
    options.autoClose = true;

    /**
     * Build a style tag with default styling to be embedded on the page.
     *
     * @return {string} The style tag markup.
     */
    app.buildStyleTag = function() {
        var styleTag = window.document.createElement('style');
        var css = `
            .mailtoui-modal {
                height: 100%;
                margin: 0;
                padding: 0;
                width: 100%;
                background-color: rgb(0,0,0);
                background-color: rgba(0,0,0,0.4);
                color: #303131;
                display: none;
                position: fixed;
                top: 0;
                right: 0;
                bottom: 0;
                left: 0;
                z-index: 1000;
            }

            .mailtoui-modal-content {
                background-color: #F1F5F8;
                border-radius: 8px;
                box-shadow: 0 4px 8px 0 rgba(0,0,0,0.2),0 6px 20px 0 rgba(0,0,0,0.19);
                padding: 0;
                max-height: calc(100% - 100px);
                top: 50%;
                left: 50%;
                right: -45%;
                bottom: auto;
                animation: appear 0.4s;
                transform: translate(-50%, -50%);
                position: fixed;
                overflow: hidden;
                overflow-y: scroll;
            }

            /* Small devices, tablets */
            @media only screen and (min-width : 768px) {
                .mailtoui-modal-content {
                    right: auto;
                }
            }

            .mailtoui-modal-head {
                background-color: #fff;
                clear: both;
                padding: 20px;
            }

            .mailtoui-modal-title {
                font-size: 100%;
                font-weight: bold;
                margin: 0;
                padding: 0;
            }

            .mailtoui-modal-close {
                color: #aaa;
                float: right;
                font-size: 38px;
                font-weight: bold;
                position: relative;
                top: -12px;
            }

            .mailtoui-modal-close:hover,
            .mailtoui-modal-close:focus {
                color: black;
                cursor: pointer;
                text-decoration: none;
            }

            .mailtoui-modal-body {
                height: 100%;
                padding: 20px;
            }

            .mailtoui-client {
                color: #333;
                outline: none;
                text-decoration: none;
            }

            .mailtoui-client:focus .mailtoui-label {
                background-color: #555;
                color: #fff;
            }

            .mailtoui-label {
                box-shadow: 0px 2px 4px rgba(0,0,0,0.18);
                background-color: #fff;
                border-radius: 100px;
                margin-bottom: 20px;
                padding: 20px 30px;
            }

            .mailtoui-label:hover {
                background-color: #555;
                color: #fff;
            }

            .mailtoui-client:last-child .mailtoui-label {
                margin-bottom: 0;
            }

            .mailtoui-label-icon {
                position: relative;
                font-weight: bold;
                top: -2px;
            }

            .mailtoui-label-text {
                margin-left: 5px;
            }

            .mailtoui-copy {
                margin-top: 20px;
                position: relative;
            }

            .mailtoui-copy-button {
                box-shadow: 0px 2px 4px rgba(0,0,0,0.18);
                background-color: #fff;
                border-radius: 100px;
                bottom: 21px;
                border: none;
                color: #303131;
                font-size: 100%;
                outline: none;
                position: absolute;
                top: 0;
                left: 0;
                height: 63px;
                width: 100px;
            }

            .mailtoui-copy-button:hover,
            .mailtoui-copy-button:focus {
                background-color: #555;
                color: #fff;
                cursor: pointer;
                outline: none;
            }

            .mailtoui-copy-email-address {
                background-color: #d8dcdf;
                color: #48494a;
                border-radius: 100px;
                border: none;
                box-sizing : border-box;
                font-size: 100%;
                padding: 20px 30px 20px 120px;
                width: 100%;
            }

            .mailtoui-is-hidden {
                visibility: hidden;
                display: none;
            }

            @keyframes appear {
                0% {
                    transform: translate(-50%, -50%) scale(0,0);
                    opacity: 0;
                }
                100% {
                    transform: translate(-50%, -50%) scale(1,1);
                    opacity: 1;
                }
            }
        `;

        css = css.replace(/mailtoui/g, app.prefix());

        styleTag.type = 'text/css';

        if (styleTag.styleSheet){
            // Required for IE8 and below.
            styleTag.styleSheet.cssText = css;
        } else {
            styleTag.appendChild(document.createTextNode(css));
        }

        return styleTag;
    };

    /**
     * Embed style tag on the page.
     */
    app.embedStyleTag = function() {
        var firstHeadChild = window.document.head.firstChild;

        window.document.head.insertBefore(app.buildStyleTag(), firstHeadChild);
    };

    /**
     * Build a modal for the email address passed in the given link object.
     *
     * @param {Element} link    The link that was clicked.
     *
     * @return {string} The modal markup.
     */
    app.buildModal = function(link) {
        var id = link.id
        var email = app.getEmail(link);
        var subject = app.getLinkSchemeField(link, 'subject');
        var cc = app.getLinkSchemeField(link, 'cc');
        var bcc = app.getLinkSchemeField(link, 'bcc');
        var body = app.getLinkSchemeField(link, 'body');
        var modal = window.document.createElement('div');
        var classHideCopyUI = app.hideCopyUI(email);
        var markup = `
            <div class="mailtoui-modal-content">
                <div class="mailtoui-modal-head">
                    <span id="mailtoui-modal-close-${id}" class="mailtoui-modal-close">&times</span>
                    <span class="mailtoui-modal-title">Compose new email</span>
                </div>
                <div class="mailtoui-modal-body">
                    <div class="mailtoui-clients">
                        <a id="mailtoui-client-${id}" class="mailtoui-client" href="https://mail.google.com/mail/?view=cm&fs=1&to=${email}&su=${subject}&cc=${cc}&bcc=${bcc}&body=${body}" target="_blank">
                            <div class="mailtoui-label">
                                <span class="mailtoui-label-icon">&#10138;</span>
                                <span class="mailtoui-label-text">with Gmail</span>
                            </div>
                        </a>

                        <a id="mailtoui-client-${id}" class="mailtoui-client" href="https://outlook.office.com/owa/?path=/mail/action/compose&to=${email}&subject=${subject}&body=${body}" target="_blank">
                            <div class="mailtoui-label">
                                <span class="mailtoui-label-icon">&#10138;</span>
                                <span class="mailtoui-label-text">with Outlook</span>
                            </div>
                        </a>

                        <a id="mailtoui-client-${id}" class="mailtoui-client" href="https://compose.mail.yahoo.com/?to=${email}&subject=${subject}&cc=${cc}&bcc=${bcc}&body=${body}" target="_blank">
                            <div class="mailtoui-label">
                                <span class="mailtoui-label-icon">&#10138;</span>
                                <span class="mailtoui-label-text">with Yahoo</span>
                            </div>
                        </a>

                        <a id="mailtoui-client-${id}" class="mailtoui-client" href="mailto:${email}?subject=${subject}&cc=${cc}&bcc=${bcc}&body=${body}">
                            <div class="mailtoui-label">
                                <span class="mailtoui-label-icon">&#10138;</span>
                                <span class="mailtoui-label-text">with local email app</span>
                            </div>
                        </a>
                    </div>

                    <div class="mailtoui-copy ${classHideCopyUI}">
                        <button id="mailtoui-copy-button-${id}" class="mailtoui-copy-button" onclick="mailtouiApp.copy('${id}');">Copy</button>
                        <input id="mailtoui-copy-email-address-${id}" class="mailtoui-copy-email-address" type="text" value="${email}" readonly>
                    </div>
                </div>
            </div>
        `;

        markup = markup.replace(/mailtoui/g, app.prefix());

        modal.id = app.prefix('-modal-' + id);
        modal.className = app.prefix('-modal');
        modal.setAttribute('style', 'display: none;');
        modal.setAttribute('aria-hidden', true);
        modal.innerHTML = markup;

        return modal;
    };

    /**
     * Embed modal on the page.
     *
     * @param {Element}  link    The link that was clicked.
     */
    app.embedModal = function(link) {
        var modal = app.buildModal(link);

        window.document.getElementById(app.prefix('-modals')).appendChild(modal);
    };

    /**
     * Embed each required modal on the page.
     *
     * @param {HTMLCollection}  The links found by getLinks().
     */
    app.embedAllModals = function() {
        var links = app.getLinks();
        var modals = window.document.createElement('div');
        var firstBodyChild = window.document.body.firstChild;

        modals.id = app.prefix('-modals');
        modals.className = app.prefix('-modals');
        modals.innerHTML = '';

        window.document.body.insertBefore(modals, firstBodyChild);

        for (var i = 0; i < links.length; i++) {
            app.embedModal(links[i]);
        }
    };

    /**
     * Get modal associated with the given link.
     *
     * @param {Element} link    The link that was clicked.
     *
     * @return {Element} The modal associated with the given link.
     */
    app.getModal = function(link) {
        if (link !== null) {
            return window.document.getElementById(app.prefix('-modal-' + link.id));
        }
    };

    /**
     * Open modal.
     *
     * @param  {Object} event   The object created by the click event.
     */
    app.openModal = function(event) {
        event.preventDefault();

        var link = event.target;

        if (link !== null) {
            lastDocElementFocused = document.activeElement;
            activeModal = app.getModal(link);
            activeModal.style.display = 'block';
            activeModal.focusableChildren = Array.from(activeModal.querySelectorAll(focusable));
            activeModal.focusableChildren[0].focus();

            app.hideModalFromScreenReader(false);
        }
    };

    /**
     * Close active modal.
     */
    app.closeModal = function() {
        if (activeModal !== null) {
            app.hideModalFromScreenReader(true);

            activeModal.style.display = 'none';
            activeModal = null;
        }

        if (lastDocElementFocused !== null) {
            lastDocElementFocused.focus();
        }
    };

    /**
     *
     */
    app.hideModalFromScreenReader = function(hidden) {
        var content = window.document.getElementById(app.prefix('-modals')).nextElementSibling;

        activeModal.setAttribute('aria-hidden', hidden);
        content.setAttribute('aria-hidden', !hidden);
    }

    /**
     * When an anchor tag (<a>) contains other elements, the element returned can vary
     * depending on where you click. We need to search up the DOM tree until we find
     * the parent anchor tag, which is the element that was intended to be clicked.
     *
     * @param   {Element}   element     The element that was clicked.
     *
     * @return {Element} The parent anchor tag of the element that was clicked.
     */
    app.getParentAnchor = function(element) {
        while (element !== null) {
            if (element.tagName.toUpperCase() === "A") {
                return element;
            }
            element = element.parentNode;
        }

        return null;
    };

    /**
     * Listen for events.
     */
    app.listenForEvents = function() {
        app.listenForClickOnLink();
        app.listenForClickOnClient();
        app.listenForClickOnClose();
        app.listenForClickOnWindow();
        app.listenForKeys();
    };

    /**
     * Listen for click event on mailto link to open modal.
     */
    app.listenForClickOnLink = function() {
        var links = window.document.getElementsByClassName(app.prefix());

        for (var i = 0; i < links.length; i++) {
            links[i].addEventListener('click', function(event) { app.openModal(event); }, false);
        }
    };

    /**
     * Listen for click event on client links to auto-close modal.
     */
    app.listenForClickOnClient = function() {
        if (options.autoClose !== true) { return };

        var clients = window.document.getElementsByClassName(app.prefix('-client'));

        for (var i = 0; i < clients.length; i++) {
            clients[i].addEventListener('click', function(event) {
                if (app.getParentAnchor(event.target) !== null) {
                    app.closeModal();
                }
            }, false);
        }
    };

    /**
     * Listen for click event on modal's close button.
     */
    app.listenForClickOnClose = function() {
        var closers = window.document.getElementsByClassName(app.prefix('-modal-close'));

        for (var i = 0; i < closers.length; i++) {
            closers[i].addEventListener('click', function(event) { app.closeModal(); }, false);
        }
    };

    /**
     * Listen for click event on window (to close modal).
     */
    app.listenForClickOnWindow = function() {
        window.addEventListener('click', function(event) {
            element = event.target;
            if (element !== null && element.classList.contains(app.prefix('-modal'))) {
                app.closeModal();
            }
        }, false);
    };

    /**
     * Listen for keydown events to escape modal or tab within it.
     */
    app.listenForKeys = function() {
        window.document.addEventListener('keydown', function(event) {
            app.escapeModal(event);
            app.trapTabWithinModal(event);
        }, false)
    }

    /**
     * Close modal when Esc key is pressed.
     *
     * @param {KeyboardEvent}   event   The event generated by pressing a key.
     */
    app.escapeModal = function(event) {
        if (event.keyCode === 27) {
            app.closeModal();
        }
    }

    /**
     * Should not be able to tab outside the modal. Pressing the tab
     * key moves focus to the next focusable element within modal.
     *
     * @param KeyboardEvent The event generated by pressing a key.
     */
    app.trapTabWithinModal = function(event) {
        if (event.keyCode === 9 && activeModal !== null) {
            var currentFocus = document.activeElement;
            var totalOfFocusable = activeModal.focusableChildren.length;
            var focusedIndex = activeModal.focusableChildren.indexOf(currentFocus);

            if (event.shiftKey) {
                if (focusedIndex === 0) {
                    event.preventDefault();
                    activeModal.focusableChildren[totalOfFocusable - 1].focus();
                }
            } else {
                if (focusedIndex == totalOfFocusable - 1) {
                    event.preventDefault();
                    activeModal.focusableChildren[0].focus();
                }
            }
        }
    }

    /**
     * Get all "bmt" links on the page.
     *
     * @return {HTMLCollection} All links with the class mailtoui-link.
     */
    app.getLinks = function() {
        return window.document.getElementsByClassName(app.prefix());
    };

    /**
     * Split the URL scheme of given link in two strings: the email address, and the
     * key-value query string. Also remove 'mailto:' to get nice clean values.
     *
     * @param  {Element}    link     The link element clicked.
     *
     * @return {array} The two parts of the link scheme separated at '?'.
     */
    app.splitLinkScheme = function(link) {
        var scheme = link.href.replace('mailto:', '').trim();
        var parts = scheme.split('?', 1);

        if (parts !== null && parts.length > 0) {
            parts[1] = scheme.replace(parts[0] + '?', '').trim();
        }

        return parts;
    }

    /**
     * Extract the value of the given field from the link.
     *
     * @param   {Element}   link    The link element clicked.
     * @param   {string}    field   The name of the field we want to get.
     *
     * @return {string} The value corresponding to the given field.
     */
    app.getLinkSchemeField = function(link, field)
    {
        var parts =  app.splitLinkScheme(link);
        var query = '';
        var terms = [];
        var keyValues = [];
        var value = '';

        if (parts !== null && parts.length > 0) {
            query = parts[1];
        }

        if (query !== null && query.length > 0) {
            // Encode any instance of ' & ' inside field values to prevent spliting at the wrong place.
            query = query.replace('%20&%20', '%20%26%20');

            terms = query.split('&');
        }

        for (var i = 0; i < terms.length; i++) {
            // Encode any instance of ' = ' inside field values to prevent spliting at the wrong place.
            terms[i] = terms[i].replace('%20=%20', '%20%3D%20');

            keyValues = terms[i].split('=');

            for (var n = 0; n < keyValues.length; n++) {
                if (keyValues[0] == field) {
                    return keyValues[1];
                }
            }
        }

        return value;
    }

    /**
     * Extract email address from the mailto: string.
     *
     * @param  {Element}    link     The link element clicked.
     *
     * @return {string} The email address.
     */
    app.getEmail = function(link) {
        var parts =  app.splitLinkScheme(link);
        var email = '';

        if (parts !== null && parts.length > 0) {
            email = parts[0];
        }

        return decodeURIComponent(email);
    }

    /**
     * If there's no email address, no need to show the Copy email address UI.
     *
     * @param   {string}    email   The email address in the mailto link.
     *
     * @return {string} The CSS class name needed to hide the Copy UI.
     */
    app.hideCopyUI = function(email) {
        if (email == null || email.trim() == '') {
            return app.prefix('-is-hidden');
        }

        return '';
    }

    /**
     * Set copy button text to indicate the email address has been copied.
     *
     * @param {string}  id  The id of the link that was clicked.
     */
    app.setCopyButtonText = function(id) {
        var button = window.document.getElementById(app.prefix('-copy-button-' + id));

        button.innerHTML = 'Copied!';
        setTimeout(function() { button.innerHTML = 'Copy'; }, 600);
    }

    /**
     * Copy email address to the clipboard.
     *
     * @param {string}  id  The id of the link that was clicked.
     */
    app.copy = function(id) {
        var email = document.getElementById(app.prefix('-copy-email-address-' + id));

        email.select();

        document.execCommand('copy');

        app.setCopyButtonText(id);
    }

    /**
     * Get user options provided in JSON format in the data attribute
     * of the script tag. Save them in the global options object.
     */
    app.setOptions = function() {
        var scripts = document.getElementsByTagName('script');
        var scriptName = scripts[scripts.length-1];
        var userOptions = scriptName.getAttribute('data-options');

        if (userOptions !== null && userOptions.trim().length > 0) {
            userOptions = JSON.parse(userOptions);

            for (var name in options) {
                if (userOptions.hasOwnProperty(name)) {
                    options[name] = userOptions[name];
                }
            }
        }
    }

    /**
     * Append the linkClass user option to the given string.
     *
     * @param {string}  text    The string to which the linkClass will be appended.
     *
     * @return {string} The linkClass user option appended to the given string.
     */
    app.prefix = function(text = '') {
        return options.linkClass + text;
    }

    /**
     * Let's kick things off.
     */
    app.run = function() {
        app.setOptions();

        app.embedAllModals();

        app.embedStyleTag();

        app.listenForEvents();
    }
})(mailtouiApp);

/**
 * "Now you wouldn't believe me if I told you, but I could run like the wind
 * blows. From that day on, if I was ever going somewhere, I was running!"
 */
mailtouiApp.run();
