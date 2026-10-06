const test = require('node:test');
const assert = require('node:assert/strict');
const { analyzeText } = require('../documents');

test('invoice extraction prefers total and due date, not minimum or hypothetical late fees', () => {
  const analysis = analyzeText('Fatura de outubro\nValor\nR$ 3.406,59\nVencimento\n01/10/2026\nPagamento mínimo R$ 510,99\nTarifas, encargos e multas R$ 0,00\nTotal R$ 3.406,59\nEm caso de atraso, juros e multa: 2,00%');
  assert.equal(analysis.kind, 'invoice');
  assert.equal(analysis.amountCents, 340659);
  assert.equal(analysis.dueDate, '2026-10-01');
  assert.equal(analysis.charges.filter(item => item.amountCents).length, 0);
  assert.equal(analysis.reviewRequired, true);
});

test('a statement is not labelled proof of payment without an actual receipt signal', () => {
  assert.equal(analyzeText('Pagamentos/créditos R$ -3.495,02\nFatura de outubro\nTotal R$ 3.406,59').kind, 'invoice');
  assert.equal(analyzeText('Comprovante de pagamento\nValor pago R$ 948,00').kind, 'receipt');
});
