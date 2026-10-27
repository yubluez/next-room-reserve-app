import prisma from "@/lib/prisma";

// POST: เพิ่มข้อมูลห้องประชุม
export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (body === null || typeof body !== "object" || Array.isArray(body)) {
      return Response.json(
        { message: "รูปแบบข้อมูลไม่ถูกต้อง" },
        { status: 400 },
      );
    }

    const { roomCode, roomName, capacity, location } = body;

    // ตรวจสอบข้อมูลที่จำเป็น
    if (
      typeof roomCode !== "string" ||
      roomCode.trim() === "" ||
      typeof roomName !== "string" ||
      roomName.trim() === "" ||
      typeof location !== "string" ||
      location.trim() === ""
    ) {
      return Response.json(
        {
          message: "กรุณากรอกรหัสห้อง ชื่อห้อง และสถานที่ให้ครบถ้วน",
        },
        { status: 400 },
      );
    }

    // ความจุต้องเป็นจำนวนเต็มบวก
    if (!Number.isInteger(capacity) || capacity <= 0) {
      return Response.json(
        {
          message: "ความจุห้องต้องเป็นจำนวนเต็มมากกว่า 0",
        },
        { status: 400 },
      );
    }

    const room = await prisma.room.create({
      data: {
        roomCode: roomCode.trim(),
        roomName: roomName.trim(),
        capacity,
        location: location.trim(),
      },
    });

    return Response.json(room, { status: 201 });
  } catch (error) {
    // P2002 = ค่าที่กำหนด unique ซ้ำ เช่น roomCode
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return Response.json(
        { message: "รหัสห้องนี้มีอยู่ในระบบแล้ว" },
        { status: 409 },
      );
    }

    console.error("Failed to create room:", error);

    return Response.json(
      { message: "พบข้อผิดพลาดในการเพิ่มข้อมูล" },
      { status: 500 },
    );
  }
}

// GET: แสดงรายการห้อง ค้นหา และกรองตามความจุ
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const search = searchParams.get("search")?.trim();
    const minCapacityParam = searchParams.get("minCapacity");

    let minCapacity: number | undefined;

    if (minCapacityParam !== null) {
      minCapacity = Number(minCapacityParam);

      if (!Number.isInteger(minCapacity) || minCapacity <= 0) {
        return Response.json(
          {
            message: "minCapacity ต้องเป็นจำนวนเต็มมากกว่า 0",
          },
          { status: 400 },
        );
      }
    }

    const rooms = await prisma.room.findMany({
      where: {
        ...(search
          ? {
              OR: [
                {
                  roomName: {
                    contains: search,
                  },
                },
                {
                  location: {
                    contains: search,
                  },
                },
              ],
            }
          : {}),
        ...(minCapacity !== undefined
          ? {
              capacity: {
                gte: minCapacity,
              },
            }
          : {}),
      },
      orderBy: {
        id: "asc",
      },
    });

    return Response.json(rooms, { status: 200 });
  } catch (error) {
    console.error("Failed to get rooms:", error);

    return Response.json(
      { message: "พบข้อผิดพลาดในการดึงข้อมูลห้อง" },
      { status: 500 },
    );
  }
}
