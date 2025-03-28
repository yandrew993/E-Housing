import prisma from "../lib/prisma.js";

export const getAllBookings = async (req, res) => {
  try {
    const booking = await prisma.booking.findMany();
    res.status(200).json(booking);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Failed to get bookings!" });
  }
};
export const getBookings = async (req, res) => {
  const tokenUserId = req.userId;

  try {
    const bookings = await prisma.booking.findMany({
      where: {
        userId: tokenUserId,
      },
      include: {
        post: true,
      },
    });
    res.status(200).json(bookings);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Failed to get bookings!" });
  }
};

export const addBooking = async (req, res) => {
  const { startDate, endDate, status, type, postId, userId, checkoutId } =
    req.body;

  try {
    const booking = await prisma.booking.create({
      data: {
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        status,
        checkoutId,
        type,
        post: {
          connect: { id: postId }, // Connect to an existing Post using postId
        },
        user: {
          connect: { id: userId }, // Connect to an existing User using userId
        },
      },
    });

    res.status(201).json(booking);
  } catch (error) {
    console.error("Error creating booking:", error);
    res.status(500).json({ error: "Failed to create booking" });
  }
};

export const bookingCount = async (req, res) => {
  try {
//     const count = await prisma.booking.count();
//     res.status(200).json(count);
//   } catch (err) {
//     console.log(err);
//     res.status(500).json({ message: "Failed to get booking count!" });
//   }
// };

        const count = await prisma.booking.count();
        res.status(200).json(count);
    } catch (err) {
        console.log(err);
        res.status(500).json({ message: "Failed to get booking count!" });
    }
    }

    export const getBookingStats = async (req, res) => {
      try {
        // Get current count of all bookings
        const currentCount = await prisma.booking.count();
        
        // Get count from previous period (e.g., last month)
        const lastMonth = new Date();
        lastMonth.setMonth(lastMonth.getMonth() - 1);
        
        const previousMonthBookings = await prisma.booking.count({
          where: {
            createdAt: {
              lt: lastMonth
            }
          }
        });
        
        // Calculate new bookings in the last month
        const newBookings = currentCount - previousMonthBookings;
        
        // Calculate percentage change
        let percentChange = 0;
        if (previousMonthBookings > 0) {
          percentChange = Math.round((newBookings / previousMonthBookings) * 100);
        } else if (currentCount > 0) {
          percentChange = 100; 
        }
        
        res.status(200).json({
          count: currentCount,
          newBookings: newBookings,
          percentChange: percentChange
        });
      } catch (err) {
        console.error("Error in getBookingStats:", err);
        res.status(500).json({ message: "Failed to get booking statistics!" });
      }
    };

