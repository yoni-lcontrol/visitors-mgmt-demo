import { Pipe, PipeTransform } from '@angular/core';
import { VisitorType } from '../enum/visitor-type.enum';

@Pipe({
  name: 'visitorTypeLabel',
})
export class VisitorTypeLabelPipe implements PipeTransform {

  transform(value: VisitorType | number | null | undefined): string {
    if (value == null)
      return 'DETAILS.UNKNOWN';

    switch (Number(value)) {
      case VisitorType.Visitor:
        return 'DETAILS.VISITOR';
      case VisitorType.Driver:
        return 'DETAILS.DRIVER';
      default:
        return 'DETAILS.UNKNOWN';
    }
  }
}