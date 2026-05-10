import { AdSyncAdapterService, AdConnectionException } from './ad-sync-adapter.service';
import { AdConfiguration } from '../settings/entities/ad-configuration.entity';

jest.mock('ldapts', () => {
    const client = {
        bind: jest.fn(),
        search: jest.fn(),
        unbind: jest.fn(),
        modify: jest.fn(),
        add: jest.fn(),
        del: jest.fn(),
        delete: jest.fn(),
    };

    return {
        Client: jest.fn().mockImplementation(() => client),
        __client: client,
    };
});

describe('AdSyncAdapterService', () => {
    let service: AdSyncAdapterService;
    let ldapClient: any;

    beforeEach(() => {
        service = new AdSyncAdapterService();
        ldapClient = (jest.requireMock('ldapts') as any).__client;
        ldapClient.bind.mockReset();
        ldapClient.search.mockReset();
        ldapClient.unbind.mockReset();
        ldapClient.modify.mockReset();
        ldapClient.add.mockReset();
        ldapClient.del.mockReset();
        ldapClient.delete.mockReset();

        ldapClient.bind.mockResolvedValue(undefined);
        ldapClient.search.mockResolvedValue({ searchEntries: [] });
        ldapClient.unbind.mockResolvedValue(undefined);
    });

    describe('validateConfig', () => {
        const validConfig = {
            id: 'c1',
            name: 'Test AD',
            domain: 'test.local',
            ldapUrl: 'ldap://dc1.test.local:389',
            baseDn: 'DC=test,DC=local',
            username: 'admin',
            password: 'pass',
            port: 389,
            useSsl: false,
            targetGroupsJson: null,
            isActive: true,
        } as AdConfiguration;

        it('should return empty array for valid config', () => {
            expect(service.validateConfig(validConfig)).toEqual([]);
        });

        it('should report missing domain', () => {
            const config = { ...validConfig, domain: '' } as AdConfiguration;
            const errors = service.validateConfig(config);
            expect(errors).toContain('domain is required');
        });

        it('should report missing ldapUrl', () => {
            const config = { ...validConfig, ldapUrl: '' } as AdConfiguration;
            const errors = service.validateConfig(config);
            expect(errors).toContain('ldapUrl is required');
        });

        it('should report missing username', () => {
            const config = { ...validConfig, username: '' } as AdConfiguration;
            const errors = service.validateConfig(config);
            expect(errors).toContain('username is required');
        });

        it('should report missing password', () => {
            const config = { ...validConfig, password: '' } as AdConfiguration;
            const errors = service.validateConfig(config);
            expect(errors).toContain('password is required');
        });

        it('should report multiple missing fields at once', () => {
            const config = { ...validConfig, domain: '', username: '', password: '' } as AdConfiguration;
            const errors = service.validateConfig(config);
            expect(errors).toHaveLength(3);
        });
    });

    describe('mapEntry', () => {
        it('should map a complete LDAP entry', () => {
            const entry = {
                sAMAccountName: 'jdoe',
                givenName: 'John',
                sn: 'Doe',
                mail: 'john@test.local',
                telephoneNumber: '123',
                department: 'IT',
                title: 'Developer',
            };

            const result = service.mapEntry(entry);
            expect(result).toEqual({
                externalId: 'jdoe',
                username: 'jdoe',
                firstName: 'John',
                lastName: 'Doe',
                email: 'john@test.local',
                phone: '123',
                department: 'IT',
                title: 'Developer',
                idNumber: null,
                company: null,
                groupNames: [],
                groupExternalIds: [],
                isDisabled: false,
            });
        });

        it('should extract AD group names from memberOf (full DN + CN)', () => {
            const entry = {
                sAMAccountName: 'jdoe',
                memberOf: [
                    'CN=Visitors Operators,OU=Groups,DC=corp,DC=local',
                    'CN=Reception,OU=Groups,DC=corp,DC=local',
                ],
            };

            const result = service.mapEntry(entry);
            expect(result.groupNames).toEqual(expect.arrayContaining([
                'CN=Visitors Operators,OU=Groups,DC=corp,DC=local',
                'Visitors Operators',
                'CN=Reception,OU=Groups,DC=corp,DC=local',
                'Reception',
            ]));
        });

        it('should use sAMAccountName as firstName when givenName is missing', () => {
            const entry = { sAMAccountName: 'jdoe', sn: 'Doe' };
            const result = service.mapEntry(entry);
            expect(result.firstName).toBe('jdoe');
        });

        it('should set nullable fields to null when missing', () => {
            const entry = { sAMAccountName: 'jdoe' };
            const result = service.mapEntry(entry);
            expect(result.email).toBeNull();
            expect(result.phone).toBeNull();
            expect(result.department).toBeNull();
            expect(result.title).toBeNull();
            expect(result.idNumber).toBeNull();
            expect(result.groupNames).toEqual([]);
        });

        it('should handle array attributes', () => {
            const entry = {
                sAMAccountName: ['jdoe'],
                givenName: ['John'],
                sn: ['Doe'],
                mail: ['john@test.local'],
            };
            const result = service.mapEntry(entry);
            expect(result.username).toBe('jdoe');
            expect(result.firstName).toBe('John');
            expect(result.email).toBe('john@test.local');
        });

        it('should prefer telephoneNumber over mobile', () => {
            const entry = {
                sAMAccountName: 'jdoe',
                telephoneNumber: '111',
                mobile: '222',
            };
            const result = service.mapEntry(entry);
            expect(result.phone).toBe('111');
        });

        it('should fall back to mobile when telephoneNumber is missing', () => {
            const entry = {
                sAMAccountName: 'jdoe',
                mobile: '222',
            };
            const result = service.mapEntry(entry);
            expect(result.phone).toBe('222');
        });
    });

    describe('fetchUsers', () => {
        it('should throw AdConnectionException for invalid config', async () => {
            const config = {
                name: 'Bad',
                domain: '',
                ldapUrl: '',
                username: '',
                password: '',
                port: 389,
                useSsl: false,
                isActive: true,
            } as AdConfiguration;

            await expect(service.fetchUsers(config)).rejects.toThrow(AdConnectionException);
            await expect(service.fetchUsers(config)).rejects.toThrow('Invalid AD configuration');
        });

        it('should throw AdConnectionException with AD_INVALID_CONFIG code', async () => {
            const config = {
                name: 'Bad',
                domain: '',
                ldapUrl: '',
                username: '',
                password: '',
                port: 389,
                useSsl: false,
                isActive: true,
            } as AdConfiguration;

            try {
                await service.fetchUsers(config);
                fail('should have thrown');
            } catch (err) {
                expect(err).toBeInstanceOf(AdConnectionException);
                expect((err as AdConnectionException).code).toBe('AD_INVALID_CONFIG');
            }
        });

        it('should use read-only LDAP operations only', async () => {
            const config = {
                id: 'c1',
                name: 'Test AD',
                domain: 'test.local',
                ldapUrl: 'ldap://dc1.test.local:389',
                baseDn: 'DC=test,DC=local',
                username: 'admin',
                password: 'pass',
                port: 389,
                useSsl: false,
                isActive: true,
            } as AdConfiguration;

            await service.fetchUsers(config);

            expect(ldapClient.bind).toHaveBeenCalled();
            expect(ldapClient.search).toHaveBeenCalled();
            expect(ldapClient.unbind).toHaveBeenCalled();
            expect(ldapClient.modify).not.toHaveBeenCalled();
            expect(ldapClient.add).not.toHaveBeenCalled();
            expect(ldapClient.del).not.toHaveBeenCalled();
            expect(ldapClient.delete).not.toHaveBeenCalled();
        });

        it('should fetch users only from configured AD groups and deduplicate', async () => {
            const config = {
                id: 'c1',
                name: 'Test AD',
                domain: 'test.local',
                ldapUrl: 'ldap://dc1.test.local:389',
                baseDn: 'DC=test,DC=local',
                username: 'admin',
                password: 'pass',
                port: 389,
                useSsl: false,
                isActive: true,
            } as AdConfiguration;

            ldapClient.search
                .mockResolvedValueOnce({
                    searchEntries: [{ distinguishedName: 'CN=Reception,OU=Groups,DC=test,DC=local', cn: 'Reception' }],
                })
                .mockResolvedValueOnce({
                    searchEntries: [{ distinguishedName: 'CN=Visitors Operators,OU=Groups,DC=test,DC=local', cn: 'Visitors Operators' }],
                })
                .mockResolvedValueOnce({
                    searchEntries: [
                        {
                            sAMAccountName: 'jdoe',
                            givenName: 'John',
                            sn: 'Doe',
                            memberOf: ['CN=Reception,OU=Groups,DC=test,DC=local'],
                        },
                        {
                            sAMAccountName: 'jdoe',
                            givenName: 'John',
                            sn: 'Doe',
                            memberOf: ['CN=Visitors Operators,OU=Groups,DC=test,DC=local'],
                        },
                    ],
                });

            const users = await service.fetchUsers(config, { targetGroups: ['Reception', 'Visitors Operators'] });

            expect(users).toHaveLength(1);
            expect(users[0].username).toBe('jdoe');
            expect(ldapClient.search).toHaveBeenCalledTimes(3);

            const userSearchFilter = ldapClient.search.mock.calls[2][1].filter as string;
            expect(userSearchFilter).toContain('(memberOf=CN=Reception,OU=Groups,DC=test,DC=local)');
            expect(userSearchFilter).toContain('(memberOf=CN=Visitors Operators,OU=Groups,DC=test,DC=local)');
        });

        it('should throw AD_GROUP_NOT_FOUND when configured groups do not exist', async () => {
            const config = {
                id: 'c1',
                name: 'Test AD',
                domain: 'test.local',
                ldapUrl: 'ldap://dc1.test.local:389',
                baseDn: 'DC=test,DC=local',
                username: 'admin',
                password: 'pass',
                port: 389,
                useSsl: false,
                isActive: true,
            } as AdConfiguration;

            ldapClient.search.mockResolvedValue({ searchEntries: [] });

            await expect(service.fetchUsers(config, { targetGroups: ['NoSuchGroup'] }))
                .rejects
                .toThrow('None of the configured AD groups were found');

            try {
                await service.fetchUsers(config, { targetGroups: ['NoSuchGroup'] });
                fail('should have thrown');
            } catch (err) {
                expect(err).toBeInstanceOf(AdConnectionException);
                expect((err as AdConnectionException).code).toBe('AD_GROUP_NOT_FOUND');
            }
        });
    });

    describe('getAttr', () => {
        it('should return empty string for undefined', () => {
            expect(service.getAttr({}, 'missing')).toBe('');
        });

        it('should return string value', () => {
            expect(service.getAttr({ name: 'test' }, 'name')).toBe('test');
        });

        it('should return first array element', () => {
            expect(service.getAttr({ name: ['first', 'second'] }, 'name')).toBe('first');
        });

        it('should return empty string for null', () => {
            expect(service.getAttr({ name: null }, 'name')).toBe('');
        });
    });
});
