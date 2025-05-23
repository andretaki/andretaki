export interface Product {
  id: string;
  title: string;
  casNumber: string;
  molecularFormula?: string;
  molecularWeight?: number;
  purity?: number;
  grade?: string;
  packaging?: string;
  price?: number;
  stock?: number;
  category?: string;
  description?: string;
  safetyData?: {
    hazardStatements?: string[];
    precautionaryStatements?: string[];
    storageConditions?: string[];
  };
  technicalData?: {
    meltingPoint?: string;
    boilingPoint?: string;
    density?: string;
    solubility?: string;
  };
} 