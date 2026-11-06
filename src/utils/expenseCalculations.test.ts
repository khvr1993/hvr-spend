import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateWeekNumber,
  formatINR,
  calculateSummary,
  calculateWeeklyMatrix,
  parseCSVTransactions,
  getMonthIdFromDate,
  formatMonthIdToName,
} from './expenseCalculations';
import { Transaction } from '../types';

test('calculateWeekNumber correctly partitions month days into 1-5 weeks', () => {
  assert.equal(calculateWeekNumber('2026-11-01'), 1);
  assert.equal(calculateWeekNumber('2026-11-07'), 1);
  assert.equal(calculateWeekNumber('2026-11-08'), 2);
  assert.equal(calculateWeekNumber('2026-11-14'), 2);
  assert.equal(calculateWeekNumber('2026-11-15'), 3);
  assert.equal(calculateWeekNumber('2026-11-21'), 3);
  assert.equal(calculateWeekNumber('2026-11-22'), 4);
  assert.equal(calculateWeekNumber('2026-11-28'), 4);
  assert.equal(calculateWeekNumber('2026-11-29'), 5);
  assert.equal(calculateWeekNumber('2026-11-30'), 5);
});

test('formatINR formats numbers with Indian currency symbol and 2 decimals', () => {
  assert.equal(formatINR(0), '₹0.00');
  assert.equal(formatINR(234762), '₹2,34,762.00');
  assert.equal(formatINR(15238), '₹15,238.00');
  assert.equal(formatINR(-500), '-₹500.00');
});

test('getMonthIdFromDate and formatMonthIdToName extract and format month boards', () => {
  assert.equal(getMonthIdFromDate('2026-12-19'), '2026-12');
  assert.equal(getMonthIdFromDate('2027-01-03'), '2027-01');
  assert.equal(formatMonthIdToName('2026-12'), 'Dec-26 Expenses');
  assert.equal(formatMonthIdToName('2027-01'), 'Jan-27 Expenses');
});

test('calculateSummary respects renamed and deleted categories in expenseBudgets', () => {
  const customBudgets: Record<string, number> = {
    'Dining & Groceries': 12000,
    'Tech & Subscriptions': 4000,
  };
  const customIncome: Record<string, number> = {
    'Primary Salary': 250000,
  };
  const summary = calculateSummary('2026-12', 'Dec-26 Expenses', 0, [], customBudgets, customIncome);
  assert.equal(summary.expenseCategoryTotals.length, 2);
  assert.equal(summary.expenseCategoryTotals[0].category, 'Dining & Groceries');
  assert.equal(summary.incomeCategoryTotals.length, 1);
  assert.equal(summary.incomeCategoryTotals[0].category, 'Primary Salary');
});

test('calculateSummary exactly matches the user screenshot calculations', () => {
  const plannedBudgets: Record<string, number> = {
    Food: 8000,
    Shopping: 10000,
    'Health/medical': 5000,
    Home: 15000,
    Transportation: 15000,
    'Guilt free': 7000,
    'Entertainment & Leisure': 3000,
    'Bills and Debt': 20000,
    Waste: 2000,
    Unplanned: 10000,
    Splurge: 5000,
  };

  const incomeBudgets: Record<string, number> = {
    Paycheck: 250000,
    Savings: 0,
    Bonus: 0,
    Interest: 0,
    Other: 0,
    'Custom category': 0,
  };

  const transactions: Transaction[] = [
    {
      id: 'tx-1',
      monthId: '2026-11',
      date: '2026-11-01',
      type: 'income',
      category: 'Paycheck',
      description: 'Monthly Salary',
      amount: 250000,
      weekNumber: 1,
      createdAt: 1,
    },
    {
      id: 'tx-2',
      monthId: '2026-11',
      date: '2026-11-02',
      type: 'expense',
      category: 'Bills and Debt',
      description: 'Electricity & Internet',
      amount: 7700,
      weekNumber: 1,
      createdAt: 2,
    },
    {
      id: 'tx-3',
      monthId: '2026-11',
      date: '2026-11-03',
      type: 'expense',
      category: 'Food',
      description: 'Groceries',
      amount: 580,
      weekNumber: 1,
      createdAt: 3,
    },
    {
      id: 'tx-4',
      monthId: '2026-11',
      date: '2026-11-04',
      type: 'expense',
      category: 'Food',
      description: 'Cafe coffee',
      amount: 242,
      weekNumber: 1,
      createdAt: 4,
    },
    {
      id: 'tx-5',
      monthId: '2026-11',
      date: '2026-11-04',
      type: 'expense',
      category: 'Transportation',
      description: 'Fuel',
      amount: 2520,
      weekNumber: 1,
      createdAt: 5,
    },
    {
      id: 'tx-6',
      monthId: '2026-11',
      date: '2026-11-05',
      type: 'expense',
      category: 'Home',
      description: 'Home items',
      amount: 1085,
      weekNumber: 1,
      createdAt: 6,
    },
    {
      id: 'tx-7',
      monthId: '2026-11',
      date: '2026-11-05',
      type: 'expense',
      category: 'Guilt free',
      description: 'Dinner',
      amount: 2732,
      weekNumber: 1,
      createdAt: 7,
    },
    {
      id: 'tx-8',
      monthId: '2026-11',
      date: '2026-11-05',
      type: 'expense',
      category: 'Entertainment & Leisure',
      description: 'Streaming',
      amount: 199,
      weekNumber: 1,
      createdAt: 8,
    },
    {
      id: 'tx-9',
      monthId: '2026-11',
      date: '2026-11-06',
      type: 'expense',
      category: 'Unplanned',
      description: 'Parking',
      amount: 40,
      weekNumber: 1,
      createdAt: 9,
    },
    {
      id: 'tx-10',
      monthId: '2026-11',
      date: '2026-11-06',
      type: 'expense',
      category: 'Splurge',
      description: 'Snack',
      amount: 140,
      weekNumber: 1,
      createdAt: 10,
    },
  ];

  const summary = calculateSummary('2026-11', 'Nov-26', 0, transactions, plannedBudgets, incomeBudgets);

  // Exact figures from screenshot
  assert.equal(summary.startBalance, 0);
  assert.equal(summary.plannedExpenses, 100000);
  assert.equal(summary.actualExpenses, 15238);
  assert.equal(summary.expenseDiff, 84762);

  assert.equal(summary.plannedIncome, 250000);
  assert.equal(summary.actualIncome, 250000);
  assert.equal(summary.incomeDiff, 0);

  assert.equal(summary.savedThisMonth, 234762);
  assert.equal(summary.endBalance, 234762);

  // Check specific categories
  const foodBudget = summary.expenseCategoryTotals.find((c) => c.category === 'Food');
  assert.equal(foodBudget?.planned, 8000);
  assert.equal(foodBudget?.actual, 822);
  assert.equal(foodBudget?.diff, 7178);

  const transBudget = summary.expenseCategoryTotals.find((c) => c.category === 'Transportation');
  assert.equal(transBudget?.planned, 15000);
  assert.equal(transBudget?.actual, 2520);
  assert.equal(transBudget?.diff, 12480);
});

test('calculateWeeklyMatrix generates accurate breakdown', () => {
  const txs: Transaction[] = [
    {
      id: '1',
      monthId: '2026-11',
      date: '2026-11-03',
      type: 'expense',
      category: 'Food',
      description: 'A',
      amount: 100,
      weekNumber: 1,
      createdAt: 1,
    },
    {
      id: '2',
      monthId: '2026-11',
      date: '2026-11-10',
      type: 'expense',
      category: 'Food',
      description: 'B',
      amount: 200,
      weekNumber: 2,
      createdAt: 2,
    },
  ];

  const matrix = calculateWeeklyMatrix('2026-11', txs, ['Food']);
  assert.equal(matrix.Food.week1, 100);
  assert.equal(matrix.Food.week2, 200);
  assert.equal(matrix.Food.total, 300);
});

test('parseCSVTransactions parses CSV lines properly', () => {
  const csv = `Date,Category,Description,Amount,Type
2026-10-05,Food,Supermarket,₹1250,Expense
2026-10-15,Bills and Debt,Electricity,3400,Expense
2026-10-01,Paycheck,Salary,250000,Income`;

  const items = parseCSVTransactions(csv, '2026-10');
  assert.equal(items.length, 3);
  assert.equal(items[0].category, 'Food');
  assert.equal(items[0].amount, 1250);
  assert.equal(items[0].type, 'expense');
  assert.equal(items[2].category, 'Paycheck');
  assert.equal(items[2].type, 'income');
});

