import Razorpay from "razorpay"

// Initialize Razorpay
// Note: This relies on RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env
export const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || "rzp_test_placeholder",
    key_secret: process.env.RAZORPAY_KEY_SECRET || "placeholder_secret",
})

export async function createOrder(amount: number) {
    const options = {
        amount: Math.round(amount * 100), // Razorpay takes whole paise; 99.99 * 100 is 9998.999…
        currency: "INR",
        receipt: `receipt_${Date.now()}`,
    }

    try {
        const order = await razorpay.orders.create(options)
        return order
    } catch (error) {
        console.error("Razorpay Error:", error)
        throw error // Handle gracefully upstack
    }
}
