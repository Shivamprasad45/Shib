import { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import axios from "axios";
import fs from "fs";
import path from "path";
import ffmpeg from "fluent-ffmpeg";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url!);
    const lat = searchParams.get("lat");
    const lng = searchParams.get("lng");

    if (!lat || !lng) {
      return NextResponse.json(
        { error: "Missing coordinates" },
        { status: 400 }
      );
    }

    // Create temporary directory
    const tempDir = path.join(process.cwd(), "public", "zoom_images");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Generate images
    const zoomLevels = Array.from({ length: 10 }, (_, i) => i + 10);
    const imagePaths: string[] = [];

    for (const zoom of zoomLevels) {
      const url = `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lng}&zoom=${zoom}&size=640x640&format=png`;
      const imagePath = path.join(tempDir, `zoom-${zoom}.png`);

      const response = await axios({ url, responseType: "stream" });

      await new Promise((resolve, reject) => {
        (response.data as NodeJS.ReadableStream)
          .pipe(fs.createWriteStream(imagePath))
          .on("finish", () => resolve(undefined))
          .on("error", reject);
      });

      imagePaths.push(imagePath);
    }

    // Generate video
    const outputPath = path.join(
      process.cwd(),
      "public",
      "videos",
      `output-${Date.now()}.mp4`
    );

    await new Promise((resolve, reject) => {
      ffmpeg()
        .input(path.join(tempDir, "zoom-%d.png"))
        .inputOptions(["-framerate 24"])
        .outputOptions(["-c:v libx264", "-pix_fmt yuv420p"])
        .duration(4)
        .save(outputPath)
        .on("end", resolve)
        .on("error", reject);
    });

    // Clean up
    imagePaths.forEach((p) => fs.unlinkSync(p));

    return NextResponse.json({
      videoUrl: `/videos/${path.basename(outputPath)}`,
      attribution: "© OpenStreetMap contributors",
    });
  } catch (error) {
    console.error("Error generating video:", error);
    return NextResponse.json(
      { error: "Video generation failed" },
      { status: 500 }
    );
  }
}
