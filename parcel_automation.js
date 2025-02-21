import { chromium } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import dotenv from "dotenv";
dotenv.config();

const credentials = {
    username: process.env.TRACKING_USERNAME,
    password: process.env.TRACKING_PASSWORD,
};

chromium.use(StealthPlugin());
// Simulate human-like typing
async function humanLikeType(page, selector, text) {
    await page.click(selector); // Ensure input is focused
    await page.type(selector, text, { delay: Math.random() * 200 + 50 });
}

// Simulate human-like mouse movement
async function humanLikeMouseMove(page, selector) {
    const box = await page.locator(selector).boundingBox();
    if (box) {
        const { x, y } = box;
        for (let i = 0; i < 5; i++) {
            await page.mouse.move(
                x + Math.random() * 10 - 5,
                y + Math.random() * 10 - 5
            );
            await page.waitForTimeout(Math.random() * 300);
        }
    }
}

async function waitForPageLoad(page, timeout = 5000) {
    try {
        // Wait for DOM to be loaded
        await page.waitForLoadState("domcontentloaded");
        console.log("DOM Content Loaded.");

        // Wait for full page load (ignores network activity)
        await page.waitForLoadState("load", { timeout });
        console.log("Page Fully Loaded (Load Event Triggered).");

        return true; // Success
    } catch (error) {
        console.error("Page did not fully load:", error.message);
        return false;
    }
}

///// CLOSE POPUP FUNCTION
async function close_popups(page, selector) {
    try {
        await page.waitForSelector(selector, { state: "visible" });
        await humanLikeMouseMove(page, selector);
        await page.click(selector);
        console.log("✅ Popup closed");
    } catch (error) {
        console.log("Popup is not present");
    }
}

async function parcel_automation(trackingId) {
    const browser = await chromium.launch({
        headless: true, // Run in visible mode or in headless mode
        args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-gpu",
            "--use-gl=desktop",
        ],
        executablePath: process.env.GOOGLE_CHROME_PATH,
    });

    const context = await browser.newContext({
        userAgent:
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        permissions: ["geolocation"],
        viewport: { width: 1920, height: 1080 },
    });

    const page = await context.newPage();

    // Remove WebDriver fingerprint to avoid bot detection
    await page.addInitScript(() => {
        Object.defineProperty(navigator, "webdriver", {
            get: () => undefined,
        });
    });

    // WebGL Fingerprint Spoofing (Fakes GPU)
    await page.addInitScript(() => {
        const getParameter = WebGLRenderingContext.prototype.getParameter;
        WebGLRenderingContext.prototype.getParameter = function (parameter) {
            if (parameter === 37445) return "NVIDIA"; // Fake GPU Vendor
            if (parameter === 37446) return "NVIDIA GeForce GTX 1080"; // Fake GPU Model
            return getParameter.call(this, parameter);
        };
    });

    // WebRTC Fingerprinting Evasion (Prevents IP Leak via WebRTC)
    await page.addInitScript(() => {
        const originalRTC = window.RTCPeerConnection;
        window.RTCPeerConnection = function (...args) {
            const pc = new originalRTC(...args);
            pc.createDataChannel = function () {}; // Disable data channel
            return pc;
        };
    });

    try {
        // This will opens ups login page
        console.log("Opening UPS login page...");
        await page.goto("https://www.ups.com/lasso/login", {
            waitUntil: "load",
        });

        /// handling popups
        page.on("dialog", async (dialog) => {
            console.log(`Popup detected: ${dialog.message()}`);
            await dialog.dismiss();
            console.log("Popup dismissed.");
        });
        // Wait for the login form
        try {
            await page.waitForSelector("#email", { state: "visible" });

            // Filling login crededentials
            // Filling Email-id
            await humanLikeMouseMove(page, "#email");
            await humanLikeType(page, "#email", credentials.username);
            await page.click("#submitBtn");
        } catch (error) {
            throw {
                success: false,
                message: "Login failed at email credentials",
            };
        }

        try {
            await page.waitForSelector("#pwd", { state: "visible" });

            // Filling password
            await humanLikeMouseMove(page, "#pwd");
            await humanLikeType(page, "#pwd", credentials.password);
            await page.click("#submitBtn");
        } catch (error) {
            throw { success: false, message: "Login failed at password" };
        }

        try {
            await page.waitForLoadState("networkidle");
            // LOGIN SUCCESSFULLLLLL
            console.log("✅ Login successful!");
            await page.waitForLoadState("domcontentloaded");
        } catch (error) {
            throw { success: false, message: "Login failed" };
        }

        //Here no popups will open

        /// Entered in Dashboard
        // Clicking for Dropdown for tracking ID

        try {
            await page.waitForSelector("#mainNavDropdown2", {
                state: "visible",
            });
            await humanLikeMouseMove(page, "#mainNavDropdown2");
            await page.click("#mainNavDropdown2");
            await page.waitForSelector(
                "//a[normalize-space()='Track a Package']",
                {
                    state: "visible",
                }
            );
            await humanLikeMouseMove(
                page,
                "//a[normalize-space()='Track a Package']"
            );
            await page.click("//a[normalize-space()='Track a Package']");
        } catch (error) {
            throw {
                success: false,
                message:
                    "Something happens at while clicking a drowdown menu tracking",
            };
        }

        ///---Tracking
        await waitForPageLoad(page);

        try {
            await page.waitForSelector(
                "//textarea[@id='stApp_trackingNumber']",
                {
                    state: "visible",
                }
            );
            await humanLikeMouseMove(
                page,
                "//textarea[@id='stApp_trackingNumber']"
            );

            /// here we are entering tracking id
            await humanLikeType(
                page,
                "//textarea[@id='stApp_trackingNumber']",
                trackingId /////// ------ Tracking id
            );

            await humanLikeMouseMove(page, "//button[@id='stApp_btnTrack']");
            await page.click("//button[@id='stApp_btnTrack']");
        } catch (error) {
            throw {
                success: false,
                message: "Something happens while entring tracking id",
            };
        }

        /// Going in the page tracking details

        await waitForPageLoad(page);
        console.log("✅ Tracking id Entered succesfully");

        /// calling popup function
        await close_popups(page, "button[data-utg-link-name='Cancel Button']");

        // selecting the change my delivery option

        try {
            await page.waitForSelector(
                "(//button[normalize-space()='Change My Delivery'])[1]",
                { state: "visible" }
            );
            await humanLikeMouseMove(
                page,
                "(//button[normalize-space()='Change My Delivery'])[1]"
            );
            await page.click(
                "(//button[normalize-space()='Change My Delivery'])[1]"
            );
        } catch (error) {
            throw {
                success: false,
                message:
                    "Something happens while selecting change my delivery option",
            };
        }

        /// Navigating to change-my-delivery option
        console.log("✅ Navigating to change-my-delivery option");

        /// waiting for page loading
        await waitForPageLoad(page);
        //selecting the delivery location

        try {
            await page.waitForSelector(
                "(//span[normalize-space()='Delivery Location'])[1]",
                { state: "visible" }
            );
            await humanLikeMouseMove(
                page,
                "(//span[normalize-space()='Delivery Location'])[1]"
            );
            await page.click(
                "(//span[normalize-space()='Delivery Location'])[1]"
            );
        } catch (error) {
            throw {
                success: false,
                message: "Something happens at change my delivery location",
            };
        }

        // waiting

        // selecting the delivery location
        try {
            await page.waitForTimeout(3000);
            await page.waitForSelector("a.ups-list_link.ups-toggle_list_link", {
                state: "visible",
            });
            await humanLikeMouseMove(
                page,
                "a.ups-list_link.ups-toggle_list_link"
            );
            await page.click("a.ups-list_link.ups-toggle_list_link");
        } catch (error) {
            throw {
                success: false,
                message: "Problem in selecting the Delivery location dropdown",
            };
        }

        await waitForPageLoad(page);
        console.log("✅ Navigated to step 1 of changing delivery location");

        // step 1 of changing the delivery option
        try {
            await page.waitForTimeout(3000);
            await page.waitForSelector("#reasonForReturn", {
                state: "visible",
            });
            await humanLikeMouseMove(page, "#reasonForReturn");
            await page.selectOption("#reasonForReturn", "AM");

            await page.click("//button[@class='ups-cta ups-cta_primary']");
        } catch (error) {
            throw {
                success: false,
                message:
                    "Something happened at step 1 in changing delivery location",
            };
        }

        console.log("✅ Done with step1 (WHY)");

        await waitForPageLoad(page);

        // step 2 of changing the delivery location
        try {
            await page.waitForSelector("//button[normalize-space()='Next']");
            await page.click("//button[normalize-space()='Next']");
        } catch (error) {
            throw {
                success: false,
                message:
                    "Something happened at step 2 in changing delivery location",
            };
        }
        console.log("✅ Done with step2 payment");

        await waitForPageLoad(page);
        ///step 3 of changing  delivery location (FINAL STEP)

        // try{
        //     await page.waitForSelector("//button[normalize-space()='Submit']");
        //     await page.click("//button[normalize-space()='Submit']");
        // }catch(error){
        //     throw {success:false,
        //         message:
        //             "Something happened at step 3 (FINAL STEP) in changing delivery location",
        //     };
        // };

        console.log("✅ Process is completed");
        return { success: true, message: "Delivery change request submitted" };
    } catch (error) {
        throw error;
    } finally {
        await browser.close();
    }
}

export { parcel_automation };
