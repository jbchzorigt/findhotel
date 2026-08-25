/**
 * Зургийн EXIF-ээс байршил, авсан цагийг унших.
 *
 * Яагаад хэрэгтэй вэ: §11.2-ийн дагуу зургийн өөрийн GPS нь маягтад бичсэн
 * байршлаас 150м-ээс хол зөрвөл илгээлт блоклогдоно — өөр газраас дарсан
 * эсвэл хуучин зургийг дахин ашиглахыг илрүүлнэ. Хяналтын шат байхгүй тул
 * энэ бол цөөхөн автомат хамгаалалтын нэг.
 *
 * ЧУХАЛ: үүнийг ШАХАХААС ӨМНӨ дуудна. Шахалт нь canvas дээр дахин зурдаг
 * тул EXIF бүрэн устдаг — энэ нь бидний хувьд давхар ашигтай: уншсаны дараа
 * алба хаагчийн утасны загвар, серийн дугаар зэрэг нийтэд гарахгүй (§10).
 */
import exifr from "exifr";

export type PhotoExif = {
  lat: number | null;
  lng: number | null;
  takenAt: Date | null;
};

const EMPTY: PhotoExif = { lat: null, lng: null, takenAt: null };

/** Браузерын `File`/`Blob`, эсвэл Node-ийн `Buffer`/`ArrayBuffer` хүлээж авна. */
export async function readPhotoExif(
  input: Blob | ArrayBuffer | Uint8Array,
): Promise<PhotoExif> {
  try {
    const [gps, parsed] = await Promise.all([
      exifr.gps(input as never).catch(() => null),
      exifr.parse(input as never, ["DateTimeOriginal"]).catch(() => null),
    ]);

    const lat = typeof gps?.latitude === "number" ? gps.latitude : null;
    const lng = typeof gps?.longitude === "number" ? gps.longitude : null;
    const raw = parsed?.DateTimeOriginal;
    const takenAt =
      raw instanceof Date && !Number.isNaN(raw.getTime()) ? raw : null;

    // Хүрээнээс гарсан утга нь эвдэрсэн EXIF — байхгүйтэй адилтгана.
    const validLat = lat !== null && lat >= -90 && lat <= 90 ? lat : null;
    const validLng = lng !== null && lng >= -180 && lng <= 180 ? lng : null;

    return { lat: validLat, lng: validLng, takenAt };
  } catch {
    // EXIF байхгүй, эвдэрсэн, эсвэл дэмжигдээгүй формат — энэ нь алдаа биш.
    // Олон утас байршлын зөвшөөрөл өгөөгүй үед EXIF-д GPS огт бичдэггүй.
    return EMPTY;
  }
}
