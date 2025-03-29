import axios from "axios";
import prisma from "../lib/prisma.js";

const getAccessToken = async () => {
  const auth = Buffer.from(
    `${process.env.CONSUMER_KEY}:${process.env.CONSUMER_SECRET}`
  ).toString("base64");
  try {
    const response = await axios.get(
      "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
      {
        headers: { Authorization: `Basic ${auth}` },
      }
    );
    return response.data.access_token;
  } catch (error) {
    console.error("Error getting access token:", error);
    throw error;
  }
};

export const payment = async (req, res) => {
  let { phone, amount } = req.body;

  if (!phone || !amount) {
    return res
      .status(400)
      .json({ error: "Phone number and amount are required" });
  }

  if (typeof phone !== "string") {
    return res.status(400).json({ error: "Invalid phone number format" });
  }

  if (phone.startsWith("07" || "0")) {
    phone = "254" + phone.substring(1); // Convert 07XXXXXXXX to 2547XXXXXXXX
  } else if (!phone.startsWith("254") || phone.length !== 12) {
    return res.status(400).json({ error: "Invalid Phone Number Format" });
  }

  try {
    const token = await getAccessToken();
    const timestamp = new Date()
      .toISOString()
      .replace(/[-:T.]/g, "")
      .slice(0, 14);
    const password = Buffer.from(
      `${process.env.BUSINESS_SHORTCODE}${process.env.PASSKEY}${timestamp}`
    ).toString("base64");

    const requestBody = {
      BusinessShortCode: process.env.BUSINESS_SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: amount,
      PartyA: phone,
      PartyB: process.env.BUSINESS_SHORTCODE,
      PhoneNumber: phone,
      CallBackURL: process.env.CALLBACK_URL,
      AccountReference: "E-Housing",
      TransactionDesc: "E-Housing Payment",
    };

    const response = await axios.post(
      "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
      requestBody,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    res.json(response.data);
  } catch (error) {
    console.error("STK Push Error:", error);
    res
      .status(500)
      .json({ error: error.response ? error.response.data : error.message });
  }
};

export const createPayment = async (req, res) => {
  const { amount, method, transactionId, bookingId } = req.body;

  // Validate required fields
  if (!amount || !method || !transactionId || !bookingId) {
    return res.status(400).json({
      error:
        "Missing required fields. Please provide amount, method, transactionId, and bookingId.",
    });
  }

  try {
    // Check if booking exists
    const bookingExists = await prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!bookingExists) {
      return res.status(404).json({ error: "Booking not found" });
    }

    // Check if transactionId is already used
    const existingPayment = await prisma.payment.findUnique({
      where: { transactionId },
    });

    if (existingPayment) {
      return res.status(409).json({ error: "Transaction ID already exists" });
    }

    // Create payment
    const payment = await prisma.payment.create({
      data: {
        amount: parseFloat(amount),
        method,
        transactionId,
        status: "pending", // Default status as defined in the model
        booking: {
          connect: { id: bookingId },
        },
      },
      include: {
        booking: true,
      },
    });

    res.status(201).json(payment);
  } catch (error) {
    console.error("Error creating payment:", error);

    // Provide more specific error messages for common cases
    if (error.code === "P2002") {
      return res.status(409).json({
        error:
          "Unique constraint violation. This booking already has a payment.",
      });
    }

    if (error.code === "P2003") {
      return res.status(404).json({
        error: "Foreign key constraint failed. The booking ID may not exist.",
      });
    }

    res
      .status(500)
      .json({ error: "Failed to create payment", details: error.message });
  }
};

export const updatePaymentStatus = async (req, res) => {
  try {
    const { status, transactionId } = req.body;

    const updatedPayment = await prisma.payment.update({
      where: {
        transactionId, // Find the record by transactionId
      },
      data: {
        status,
        transactionId,
      },
    });

    if (!updatedPayment) {
      return res
        .status(404)
        .json({ success: false, error: "Payment not found." });
    }

    res.status(200).json({
      success: true,
      message: "Payment status updated.",
      updatedPayment,
    });
  } catch (error) {
    console.error("Error updating payment status:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to update payment." });
  }
};
