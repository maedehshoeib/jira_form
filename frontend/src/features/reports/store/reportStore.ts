import { create } from "zustand";

import { mockReports } from "../data/mockReports";

import { Report } from "../types/report";

type Store={

reports:Report[];

addReport:(report:Report)=>void;

};

export const useReportStore=create<Store>((set)=>({

reports:mockReports,

addReport:(report)=>set((state)=>({

reports:[report,...state.reports]

}))

}));