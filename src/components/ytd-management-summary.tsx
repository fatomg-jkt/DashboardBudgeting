"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

type Company = "1001" | "maison_y";
type ApiRow = Record<string, unknown>;

type DetailRow = {
  perusahaan: string;
  tahun: string;
  bulan: string;
  department: string;
  costCenter: string;
  kodeAkun: string;
  namaAkun: string;
  kategori: string;
  budget: number;
  actual