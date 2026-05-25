import dataSource from './src/database/data-source';

async function main() {
    await dataSource.initialize();
    
    // Directly simulate the service call
    const visitorRepo = dataSource.getRepository('Visitors');
    const visitor = await visitorRepo.findOne({ where: { personId: '311529994', isActive: true } });
    console.log('Step 1 - Visitor found:', !!visitor, visitor ? visitor.id : 'N/A');

    if (visitor) {
        const now = new Date();
        const startOfDay = new Date(now);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(now);
        endOfDay.setHours(23, 59, 59, 999);
        
        console.log('Step 2 - Date range:', startOfDay.toISOString(), 'to', endOfDay.toISOString());
        
        const vv = await dataSource.getRepository('VisitVisitors')
            .createQueryBuilder('vv')
            .innerJoinAndSelect('vv.visit', 'visit')
            .leftJoinAndSelect('vv.status', 'status')
            .where('vv.visitorId = :visitorId', { visitorId: visitor.id })
            .andWhere('vv.isActive = :active', { active: true })
            .andWhere('visit.isActive = :active', { active: true })
            .andWhere('visit.plannedStartTimeUtc <= :endOfDay', { endOfDay })
            .andWhere('(visit.plannedEndTimeUtc >= :startOfDay OR visit.plannedEndTimeUtc IS NULL)', { startOfDay })
            .orderBy('visit.plannedStartTimeUtc', 'DESC')
            .getOne();
            
        console.log('Step 3 - VisitVisitor found:', !!vv);
        if (vv) {
            console.log('Visit:', JSON.stringify({ id: vv.visit?.id, title: vv.visit?.title }, null, 2));
        }
    }
    
    await dataSource.destroy();
}
main().catch(console.error);
