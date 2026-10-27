import prisma from "@/lib/prisma";

// GET: ค้นหาห้องว่างตามช่วงเวลา
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const startTime = searchParams.get("startTime");
    const endTime = searchParams.get("endTime");
    const attendeeCountParam = searchParams.get("attendeeCount");

    // ต้องระบุเวลาเริ่มและเวลาสิ้นสุด
    if (!startTime || !endTime) {
      return Response.json(
        {
          message: "กรุณาระบุ startTime และ endTime",
        },
        { status: 400 },
      );
    }

    const startDate = new Date(startTime);
    const endDate = new Date(endTime);

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      return Response.json(
        { message: "รูปแบบวันที่ไม่ถูกต้อง" },
        { status: 400 },
      );
    }

    if (startDate >= endDate) {
      return Response.json(
        { message: "startTime ต้องอยู่ก่อน endTime" },
        { status: 400 },
      );
    }

    // ตรวจสอบจำนวนผู้เข้าร่วม ถ้ามีการระบุ
    let attendeeCount: number | undefined;

    if (attendeeCountParam !== null) {
      attendeeCount = Number(attendeeCountParam);

      if (!Number.isInteger(attendeeCount) || attendeeCount <= 0) {
        return Response.json(
          {
            message: "attendeeCount ต้องเป็นจำนวนเต็มมากกว่า 0",
          },
          { status: 400 },
        );
      }
    }

    const rooms = await prisma.room.findMany({
      where: {
        ...(attendeeCount !== undefined
          ? {
              capacity: {
                gte: attendeeCount,
              },
            }
          : {}),
        bookings: {
          none: {
            startTime: {
              lt: endDate,
            },
            endTime: {
              gt: startDate,
            },
          },
        },
      },
      orderBy: {
        id: "asc",
      },
    });

    return Response.json(rooms, { status: 200 });
  } catch (error) {
    console.error("Failed to find available rooms:", error);

    return Response.json(
      { message: "พบข้อผิดพลาดในการค้นหาห้องว่าง" },
      { status: 500 },
    );
  }
}
