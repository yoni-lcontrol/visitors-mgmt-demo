import dataSource from './src/database/data-source';
async function main() {
    await dataSource.initialize();
    const visitor = await dataSource.query("SELECT id, firstName, lastName, personId, isActive FROM Visitors WHERE personId = '311529994'");
    console.log('Visitor:', JSON.stringify(visitor, null, 2));
    if (visitor.length > 0) {
        const vv = await dataSource.query("SELECT vv.id, vv.visitId, vv.visitorId, vv.isActive, v.title, v.plannedStartTimeUtc, v.plannedEndTimeUtc, v.isActive as visitIsActive FROM VisitVisitors vv INNER JOIN Visits v ON v.id = vv.visitId WHERE vv.visitorId = '" + visitor[0].id + "' AND vv.isActive = 1 ORDER BY v.plannedStartTimeUtc DESC");
        console.log('VisitVisitors:', JSON.stringify(vv, null, 2));
    }
    await dataSource.destroy();
}
main().catch(console.error);
