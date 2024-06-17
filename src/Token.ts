import { AoInstance, TokenInfo, Id, Owner, getTagValue, Message, Balances, isAddress } from "./utils";
import { connect, createDataItemSigner } from "@permaweb/aoconnect";
import Quantity from "./Quantity";

export default async function Token(
  id: string,
  // @ts-expect-error
  signer = createDataItemSigner(window.arweaveWallet),
  ao = connect()
) {
  // query ao
  const res = await ao.dryrun({
    Id,
    Owner,
    process: id,
    tags: [{ name: "Action", value: "Info" }]
  });

  // find message with token info
  for (const msg of res.Messages as Message[]) {
    const Ticker = getTagValue("Ticker", msg.Tags);
    const Name = getTagValue("Name", msg.Tags);
    const Denomination = getTagValue("Denomination", msg.Tags);
    const Logo = getTagValue("Logo", msg.Tags);
    const Mirror = getTagValue("Balance-Mirror", msg.Tags);

    if (!Ticker && !Name) continue;

    // if the message was found, return the token details
    return new TokenInstance(
      id,
      {
        Name,
        Ticker,
        Denomination: BigInt(Denomination || 0),
        Logo,
        Mirror,
      },
      signer,
      ao
    );
  }

  throw new Error("Could not load token info.");
}

export class TokenInstance {
  // token id
  #id: string;

  // token info
  #info: TokenInfo;

  // ao instance
  #ao: AoInstance;

  // signer instance
  #signer: ReturnType<typeof createDataItemSigner>;

  /**
   * @param id Token process ID
   * @param info Optional loaded token info
   */
  constructor(id: string, info: TokenInfo, signer: ReturnType<typeof createDataItemSigner>, ao: AoInstance) {
    this.#id = id;
    this.#info = info;
    this.#ao = ao;
    this.#signer = signer;
  }

  /**
   * Token ID
   */
  get id() {
    return this.#id;
  }

  /**
   * Get token info
   */
  get info() {
    return this.#info;
  }

  /**
   * Get a quantity instance for this token. The instance
   * will have the token's denomination defined by default.
   */
  get Quantity() {
    return new Quantity(
      0n,
      this.info.Denomination
    );
  }

  /**
   * Get balance for an address
   * @param address Wallet address
   * @returns Balance in Quantity format
   */
  async getBalance(address: string) {
    // query ao
    const process = this.#info.Mirror ? this.#info.Mirror : this.#id;
    const res = await this.#ao.dryrun({
      Id,
      Owner: address,
      process,
      tags: [{ name: "Action", value: "Balance" }]
    });

    // find result message
    for (const msg of res.Messages as Message[]) {
      const balance = this.#info.Mirror
        ? msg.Data
        : getTagValue("Balance", msg.Tags);

      // return balance if found
      if (balance) {
        return new Quantity(
          BigInt(balance),
          this.#info.Denomination
        );
      }
    }

    // default return
    return new Quantity(0, this.#info.Denomination);
  }

  /**
   * Get all balances
   * @returns Token balances
   */
  async getBalances(): Promise<Balances> {
    // query ao
    const res = await this.#ao.dryrun({
      Id,
      Owner,
      process: this.#id,
      tags: [{ name: "Action", value: "Balances" }]
    });
    const bals: Balances = {};

    // find result message
    for (const msg of res.Messages as Message[]) {
      // return balance if found
      if (msg.Target !== Owner|| !msg.Data) continue;

      try {
        const raw = JSON.parse(msg.Data);

        for (const addr in raw) {
          bals[addr] = new Quantity(
            BigInt(raw[addr]), 
            this.#info.Denomination
            );
        }
      } catch {}
    }

    return bals;
  }

  /**
   * Transfer tokens to another address
   * @param quantity Amount to transfer
   * @param recipient Transfer recipient
   * @returns Transfer message ID
   */
  async transfer(quantity: Quantity, recipient: string) {
    // check address
    if (!isAddress(recipient)) {
      throw new Error("Invalid recipient address");
    }

    // check quantity
    if (!Quantity.isQuantityOf(quantity, this)) {
      throw new Error("Invalid quantity for this token");
    }

    return await this.#ao.message({
      process: this.#id,
      signer: this.#signer,
      tags: [
        { name: "Action", value: "Transfer" },
        { name: "Recipient", value: recipient },
        { name: "Quantity", value: quantity.raw.toString() }
      ]
    });
  }
}
