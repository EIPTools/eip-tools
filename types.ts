export interface ValidEIPs {
  [eipNo: string]: {
    title: string;
    status?: string;
    isERC?: boolean;
    prNo?: number;
    markdownPath: string;
    requires?: string[];
    timestamp?: string;
  };
}

export interface EipMetadataJson {
  eip: string;
  title: string;
  description: string;
  author: string[];
  "discussions-to": string;
  status: string;
  type: string;
  category: string;
  created: string;
  requires: string[];
}

export enum EIPType {
  EIP = "EIP",
  RIP = "RIP",
  CAIP = "CAIP",
}

export interface IPageVisit {
  eipNo: string;
  type?: EIPType;
  timestamp: Date;
}

export interface IAISummary {
  eipNo: string;
  summary: string;
  eipStatus: string;
  timestamp: Date;
}

export interface FilteredSuggestion {
  title: string;
  status?: string;
  isERC?: boolean;
  prNo?: number;
  markdownPath: string;
  eipNo: string;
  type: EIPType;
}

export interface SearchSuggestion {
  label: string;
  data: FilteredSuggestion;
}

export interface GraphNode {
  id: string;
  isERC?: boolean;
  eipNo: string;
  title: string;
  status: string;
  type?: string;
  category?: string;
}

export interface GraphLink {
  source: string;
  target: string;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}
