// SPDX-License-Identifier: Apache-2.0
// Covers: zoe/offer-up.contract.js

import { test } from '@agoric/zoe/tools/prepare-test-env-ava.js';

import { AmountMath, makeIssuerKit } from '@agoric/ertp';
import { E } from '@endo/far';
import { makeCopyBag } from '@endo/patterns';

import { startZoeWith } from './support.js';

const setup = async (terms = undefined) => {
  const { zoe, installation } = await startZoeWith('zoe/offer-up.contract.js');
  const money = makeIssuerKit('PlayMoney');
  const tradePrice = AmountMath.make(money.brand, 5n);
  const { publicFacet, instance } = await E(zoe).startInstance(
    installation,
    { Price: money.issuer },
    terms ?? { tradePrice },
  );
  const terms2 = await E(zoe).getTerms(instance);
  return { zoe, money, tradePrice, publicFacet, itemBrand: terms2.brands.Item, itemIssuer: terms2.issuers.Item };
};

const itemsAmount = (brand, names) =>
  AmountMath.make(brand, makeCopyBag(names.map(n => [n, 1n])));

test('meta.customTermsShape refuses bad terms at start', async t => {
  const { zoe, installation } = await startZoeWith('zoe/offer-up.contract.js');
  const money = makeIssuerKit('PlayMoney');
  await t.throwsAsync(
    E(zoe).startInstance(installation, { Price: money.issuer }, { tradePrice: 5n }),
    { message: /customTerms: tradePrice: .* - Must be a copyRecord/ },
  );
});

test('a buyer who pays the price gets the items', async t => {
  const { zoe, money, tradePrice, publicFacet, itemBrand, itemIssuer } = await setup();
  const want = itemsAmount(itemBrand, ['map', 'scroll']);
  const seat = await E(zoe).offer(
    E(publicFacet).makeTradeInvitation(),
    harden({ give: { Price: tradePrice }, want: { Items: want } }),
    harden({ Price: money.mint.mintPayment(tradePrice) }),
  );
  t.is(await E(seat).getOfferResult(), 'trade complete');
  const items = await E(itemIssuer).getAmountOf(E(seat).getPayout('Items'));
  t.deepEqual(items, want);
});

test('the proposal shape refuses underpayment before escrow', async t => {
  const { zoe, money, publicFacet, itemBrand } = await setup();
  const tooLittle = AmountMath.make(money.brand, 4n);
  await t.throwsAsync(
    E(zoe).offer(
      E(publicFacet).makeTradeInvitation(),
      harden({ give: { Price: tooLittle }, want: { Items: itemsAmount(itemBrand, ['map']) } }),
      harden({ Price: money.mint.mintPayment(tooLittle) }),
    ),
    { message: /"buy items" proposal: give: Price: .* - Must be >= / },
  );
});

test('more than maxItems is refused and refunded', async t => {
  const { zoe, money, tradePrice, publicFacet, itemBrand } = await setup();
  const seat = await E(zoe).offer(
    E(publicFacet).makeTradeInvitation(),
    harden({ give: { Price: tradePrice }, want: { Items: itemsAmount(itemBrand, ['a', 'b', 'c', 'd']) } }),
    harden({ Price: money.mint.mintPayment(tradePrice) }),
  );
  await t.throwsAsync(E(seat).getOfferResult(), { message: /max "\[3n\]" items allowed/ });
  t.deepEqual(await money.issuer.getAmountOf(E(seat).getPayout('Price')), tradePrice);
});
