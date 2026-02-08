/**
 * IOCCardFactory.ts - CRUD helper for the IOC_TYPES registry.
 *
 * Provides static methods to add, read, check, and remove IOC types at
 * runtime. This allows future support for user-defined custom IOC types
 * without modifying IOCCardsTypes.ts directly.
 *
 * All mutations operate on the shared `IOC_TYPES` object from
 * IOCCardsTypes.ts, so changes are immediately visible to every consumer
 * (the type selector modal, card renderer, timeline processors, etc.).
 */
import { IOCField, IOC_TYPES } from './IOCCardsTypes';

export class IOCCardFactory {
  /**
   * Register a fully specified IOC type. The caller supplies every field
   * explicitly -- use this when you need full control over the field list.
   */
  static addIOCType(
    id: string,
    name: string,
    color: string,
    svg: string,
    fields: string[],
    icon: string = 'info'
  ): void {
    IOC_TYPES[id] = {
      name,
      icon,
      color,
      fields,
      svg
    };
  }

  /**
   * Convenience wrapper that pre-populates the standard forensic fields
   * (value, source, time_of_event, splunk_query, tactic, technique) and
   * appends any additional custom fields. Useful for quickly bootstrapping
   * a new IOC type that follows the common card layout.
   */
  static createCustomIOC(
    id: string,
    name: string,
    color: string,
    svg: string,
    additionalFields: string[] = []
  ): void {
    const defaultFields = ['value', 'source', 'time_of_event', 'splunk_query', 'tactic', 'technique'];
    const allFields = [...defaultFields, ...additionalFields];

    this.addIOCType(id, name, color, svg, allFields);
  }

  /** Returns the entire mutable IOC_TYPES registry. */
  static getAllTypes(): typeof IOC_TYPES {
    return IOC_TYPES;
  }

  /** Looks up a single IOC type by its snake_case key. */
  static getType(id: string): IOCField | undefined {
    return IOC_TYPES[id];
  }

  /** Returns true if the given key exists in the registry. */
  static hasType(id: string): boolean {
    return id in IOC_TYPES;
  }

  /** Removes an IOC type. Returns false if the key was not found. */
  static removeType(id: string): boolean {
    if (this.hasType(id)) {
      delete IOC_TYPES[id];
      return true;
    }
    return false;
  }
}
