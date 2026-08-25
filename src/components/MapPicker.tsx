"use client";

/**
 * Байршил сонгох газрын зураг — Leaflet + OpenStreetMap.
 *
 * `react-leaflet` ашиглаагүй: React 19 / Next 16-тай хувилбарын зөрчил гарах
 * эрсдэлтэй ба энд хэрэгтэй зүйл нь ердөө нэг чирдэг тэмдэглэгээ. Leaflet-ийг
 * шууд дуудах нь хамаарал цөөн, зан төлөв тодорхой байлгана.
 *
 * Тэмдэглэгээнд `divIcon` ашигласан нь санамсаргүй биш: Leaflet-ийн үндсэн
 * тэмдэглэгээ нь зургийн файл татдаг ба bundler-ийн зам эвдэрдэг сонгодог
 * асуудалтай. CSS-ээр зурсан цэг тэр бүхнийг тойрно.
 */
import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

type Props = {
  lat: number;
  lng: number;
  /** Алба хаагч цэгийг чирвэл дуудагдана. */
  onMove: (lat: number, lng: number) => void;
  /** Ойролцоох бусад бүртгэл — жижиг саарал цэгээр харагдана. */
  markers?: Array<{ lat: number; lng: number; name: string }>;
};

export function MapPicker({ lat, lng, onMove, markers = [] }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const markerRef = useRef<import("leaflet").Marker | null>(null);
  const extrasRef = useRef<import("leaflet").Layer[]>([]);
  /*
   * `onMove`-г ref-д хадгална: газрын зураг нэг л удаа үүсэх ёстой тул
   * доорх effect-ийн хамаарлын жагсаалтад callback байж болохгүй (эцэг
   * компонент дахин зурагдах бүрт газрын зураг устаж дахин үүсэх байсан).
   * Шинэчлэлтийг render дотор биш, effect дотор хийнэ — React 19-ийн
   * concurrent render үед render нь цэвэр байх ёстой.
   */
  const onMoveRef = useRef(onMove);
  useEffect(() => {
    onMoveRef.current = onMove;
  }, [onMove]);

  // Газрын зургийг НЭГ л удаа үүсгэнэ.
  useEffect(() => {
    let cancelled = false;
    let map: import("leaflet").Map | undefined;

    // Leaflet нь `window`-д хандах тул зөвхөн браузерт ачаална.
    void import("leaflet").then((L) => {
      if (cancelled || !containerRef.current || mapRef.current) return;

      map = L.map(containerRef.current, {
        center: [lat, lng],
        zoom: 18,
        zoomControl: true,
      });
      mapRef.current = map;

      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        // ODbL-ийн шаардлага (§13.3) — арилгаж болохгүй.
        attribution: "© OpenStreetMap contributors",
      }).addTo(map);

      const icon = L.divIcon({
        className: "",
        html: '<div class="hfs-pin"></div>',
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });

      const marker = L.marker([lat, lng], { icon, draggable: true }).addTo(map);
      marker.on("dragend", () => {
        const position = marker.getLatLng();
        onMoveRef.current(position.lat, position.lng);
      });
      markerRef.current = marker;

      // Газрын зураг дээр дарахад ч цэг зөөгдөнө — чирэхээс хялбар.
      map.on("click", (event: import("leaflet").LeafletMouseEvent) => {
        marker.setLatLng(event.latlng);
        onMoveRef.current(event.latlng.lat, event.latlng.lng);
      });
    });

    return () => {
      cancelled = true;
      map?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // Зориуд хоосон: газрын зураг нэг удаа үүсэх ёстой. Байршлын
    // өөрчлөлтийг доорх effect зохицуулна.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Гаднаас байршил өөрчлөгдвөл ([📍] дарсан, POI сонгосон) дагуулна.
  useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;
    if (!map || !marker) return;
    marker.setLatLng([lat, lng]);
    map.setView([lat, lng], map.getZoom());
  }, [lat, lng]);

  // Ойролцоох бүртгэлүүд.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    void import("leaflet").then((L) => {
      extrasRef.current.forEach((layer) => layer.remove());
      extrasRef.current = markers.map((item) =>
        L.circleMarker([item.lat, item.lng], {
          radius: 6,
          color: "#dc2626",
          fillColor: "#dc2626",
          fillOpacity: 0.65,
          weight: 1,
        })
          .bindTooltip(item.name)
          .addTo(map),
      );
    });
  }, [markers]);

  return (
    <div
      ref={containerRef}
      className="h-56 w-full rounded-lg border border-slate-300"
      // Leaflet нь эцэг элементийн өндрийг шаарддаг.
      style={{ minHeight: "14rem" }}
    />
  );
}
