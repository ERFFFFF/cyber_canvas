import { IOCField, IOC_TYPES } from './IOCCardsTypes';

export class IOCCardFactory {
  // Add a new IOC type dynamically
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

  // Quick create helper with default fields
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

  // Get all IOC types
  static getAllTypes(): typeof IOC_TYPES {
    return IOC_TYPES;
  }

  // Get specific IOC type
  static getType(id: string): IOCField | undefined {
    return IOC_TYPES[id];
  }

  // Check if IOC type exists
  static hasType(id: string): boolean {
    return id in IOC_TYPES;
  }

  // Remove IOC type
  static removeType(id: string): boolean {
    if (this.hasType(id)) {
      delete IOC_TYPES[id];
      return true;
    }
    return false;
  }
}
