// Simulation de budget du pèlerin (montants dans `currency`).
export class BudgetSimulationShape {
  id!: string;
  pilgrimId!: string;
  packageId!: string | null;
  packagePrice!: number;
  pocketMoney!: number;
  gifts!: number;
  sacrifice!: number;
  insurance!: number;
  otherExpenses!: number;
  currency!: string;
  createdAt!: Date;
  updatedAt!: Date;
}
