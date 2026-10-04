import axiosClient from "./axiosClient";

export interface PrayerTimesResponse {
  date: string;
  hijriDate: string;
  timings: Record<string, string>;
}

export const getPrayerTimesByCoords = (latitude: number, longitude: number, method = 2, school = 0) =>
  axiosClient.get<PrayerTimesResponse>("/prayertimes", { params: { latitude, longitude, method, school } });

export const getPrayerTimesByCity = (city: string, country: string, method = 2, school = 0) =>
  axiosClient.get<PrayerTimesResponse>("/prayertimes/by-city", { params: { city, country, method, school } });